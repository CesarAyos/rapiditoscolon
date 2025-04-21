<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { writable } from 'svelte/store';
	import { browser } from '$app/environment';
	import { supabase } from '../../../components/supabase';
	import Lock from '../../../components/lock.svelte';
	import type { Session, Subscription } from '@supabase/supabase-js';

	type Conductor = {
		id: number;
		nombre: string;
		placa: string;
		email: string;
		control: string;
		propiedad: string;
		telefono?: string | null;
	};

	type EstadoPosible =
		| 'en_servicio_colon'
		| 'en_servicio_ureña'
		| 'en_ruta_colon_ureña'
		| 'en_ruta_ureña_colon'
		| 'accidentado'
		| 'descanso';

	// Stores
	const conductor = writable<Conductor | null>(null);
	const estadoActual = writable<EstadoPosible>('descanso');
	const error = writable<string>('');
	const isLoading = writable<boolean>(false);
	const session = writable<Session | null>(null);

	// Variables reactivas
	let conductorData: Conductor | null = null;
	let currentEstado: EstadoPosible = 'descanso';
	let errorMessage = '';
	let loading = false;
	let currentSession: Session | null = null;

	// Suscripciones
	conductor.subscribe((value) => (conductorData = value));
	estadoActual.subscribe((value) => (currentEstado = value));
	error.subscribe((value) => (errorMessage = value));
	isLoading.subscribe((value) => (loading = value));
	session.subscribe((value) => (currentSession = value));

	const getSession = async (): Promise<Session | null> => {
		try {
			const { data, error: sbError } = await supabase.auth.getSession();

			if (sbError) throw sbError;
			if (!data.session) return null;

			session.set(data.session);
			return data.session;
		} catch (err) {
			console.error('Error en getSession:', err);
			error.set(err instanceof Error ? err.message : 'Error de autenticación');
			isLoading.set(false);
			return null;
		}
	};

	const obtenerConductor = async (): Promise<boolean> => {
		isLoading.set(true);
		error.set('');

		try {
			if (!currentSession?.user?.email) {
				throw new Error('No hay usuario autenticado');
			}

			const { data, error: sbError } = await supabase
				.from('conductor')
				.select('*')
				.eq('email', currentSession.user.email)
				.single();

			if (sbError) throw sbError;
			if (!data) throw new Error('Conductor no encontrado');

			conductor.set(data);
			await obtenerUltimoEstado(data.id);
			return true;
		} catch (err) {
			console.error('Error en obtenerConductor:', err);
			error.set(err instanceof Error ? err.message : 'Error al cargar datos');
			conductor.set(null);
			return false;
		} finally {
			isLoading.set(false);
		}
	};

	const obtenerUltimoEstado = async (conductorId: number): Promise<void> => {
		try {
			const { data, error: sbError } = await supabase
				.from('estado_conductor')
				.select('estado')
				.eq('conductor_id', conductorId)
				.order('created_at', { ascending: false })
				.limit(1)
				.maybeSingle();

			if (sbError) throw sbError;

			if (data?.estado && isValidEstado(data.estado)) {
				estadoActual.set(data.estado);
			} else {
				estadoActual.set('descanso');
			}
		} catch (err) {
			console.error('Error obteniendo estado:', err);
			error.set('Error al cargar estado actual');
			estadoActual.set('descanso');
		}
	};

	const isValidEstado = (estado: string): estado is EstadoPosible => {
		return [
			'en_servicio_colon',
			'en_servicio_ureña',
			'en_ruta_colon_ureña',
			'en_ruta_ureña_colon',
			'accidentado',
			'descanso'
		].includes(estado);
	};

	const cambiarEstado = async (
		nuevoEstado: EstadoPosible,
		descripcion: string = ''
	): Promise<void> => {
		if (!conductorData?.id) {
			error.set('No hay datos del conductor');
			return;
		}

		isLoading.set(true);

		try {
			// 1. Buscar el último estado registrado
			const { data: ultimoEstado, error: queryError } = await supabase
				.from('estado_conductor')
				.select('id')
				.eq('conductor_id', conductorData.id)
				.order('created_at', { ascending: false })
				.limit(1)
				.maybeSingle();

			if (queryError) throw queryError;

			// 2. Decidir si actualizar o insertar
			if (ultimoEstado?.id) {
				// Actualizar el último registro existente
				const { error: updateError } = await supabase
					.from('estado_conductor')
					.update({
						estado: nuevoEstado,
						descripcion: descripcion || null,
						updated_at: new Date().toISOString() // Campo opcional para tracking
					})
					.eq('id', ultimoEstado.id);

				if (updateError) throw updateError;
			} else {
				// Crear un nuevo registro si no existe uno previo
				const { error: insertError } = await supabase.from('estado_conductor').insert({
					conductor_id: conductorData.id,
					estado: nuevoEstado,
					descripcion: descripcion || null,
					created_at: new Date().toISOString()
				});

				if (insertError) throw insertError;
			}

			// 3. Actualizar el estado en el frontend
			estadoActual.set(nuevoEstado);
			error.set(`✅ Estado actualizado: ${nuevoEstado}`);
			setTimeout(() => error.set(''), 3000);
		} catch (err) {
			console.error('Error al cambiar estado:', err);
			error.set(err instanceof Error ? err.message : 'Error al actualizar estado');
			setTimeout(() => error.set(''), 5000);
		} finally {
			isLoading.set(false);
		}
	};

	onMount(() => {
		let authListener: { subscription: Subscription } | null = null;

		const initialize = async () => {
			try {
				const userSession = await getSession();
				if (userSession) {
					await obtenerConductor();
				}
			} catch (error) {
				console.error('Error en inicialización:', error);
				isLoading.set(false);
			}
		};

		initialize();

		// Configurar listener de autenticación con tipado correcto
		const { data: authData } = supabase.auth.onAuthStateChange(async (event, authSession) => {
			if (event === 'SIGNED_IN' && authSession) {
				session.set(authSession); // Usamos el store session.set()
				await obtenerConductor();
			} else if (event === 'SIGNED_OUT') {
				conductor.set(null);
				estadoActual.set('descanso');
				session.set(null);
				error.set('');
			}
		});

		authListener = authData;

		return () => {
			if (authListener?.subscription) {
				authListener.subscription.unsubscribe();
			}
		};
	});
</script>

<div class="dashboard-container">
	<nav class="dashboard-nav">
		<div class="nav-user">
			{#if conductorData}
				<div class="badge-container">
					<span class="user-badge">Control: {conductorData.control}</span>
					<span class="user-badge">{conductorData.propiedad}: {conductorData.nombre}</span>
					<span class="user-badge">Placa: {conductorData.placa}</span>
					<a href="/auth/dashboard-conductor/maps" class="user-badge">Mapa</a>
					<Lock />
				</div>
			{:else}
				<span class="user-name">No autenticado</span>
			{/if}
		</div>
	</nav>

	<main class="dashboard-content">
		<div class="content-wrapper">
			{#if loading}
				<div class="loading-overlay">
					<div class="spinner"></div>
					<p>Cargando datos...</p>
				</div>
			{:else if conductorData}
				<div class="info-panel">
					<div class="info-header">
						<h2>Estado Actual</h2>
						<div class="status-badge {currentEstado.toLowerCase().replace(' ', '-')}">
							{currentEstado}
						</div>
					</div>
					<div class="info-grid">
						<div class="info-item">
							<span class="info-label">Nombre:</span>
							<span>{conductorData.nombre}</span>
						</div>
						<div class="info-item">
							<span class="info-label">Placa:</span>
							<span>{conductorData.placa}</span>
						</div>
						<div class="info-item">
							<span class="info-label">Teléfono:</span>
							<span>{conductorData.telefono || 'N/A'}</span>
						</div>
					</div>
				</div>

				<div class="actions-panel">
					<h3>Cambiar Estado</h3>
					<div class="actions-grid">
						<button
							type="button"
							on:click={() => cambiarEstado('en_servicio_colon', 'Ubicación: Colón')}
							class="action-btn service"
						>
							<span class="icon">🚕</span>
							<span class="label">En Servicio Colón</span>
						</button>

						<button
							type="button"
							on:click={() => cambiarEstado('en_servicio_ureña', 'Ubicación: Ureña')}
							class="action-btn service"
						>
							<span class="icon">🚕</span>
							<span class="label">En Servicio Ureña</span>
						</button>

						<button
							type="button"
							on:click={() => cambiarEstado('descanso')}
							class="action-btn rest"
						>
							<span class="icon">🛌</span>
							<span class="label">Descanso</span>
						</button>

						<button
							type="button"
							on:click={() => cambiarEstado('en_ruta_colon_ureña', 'Ruta: Colón → Ureña')}
							class="action-btn route"
						>
							<span class="icon">🛣️</span>
							<span class="label">Colón → Ureña</span>
						</button>

						<button
							type="button"
							on:click={() => cambiarEstado('en_ruta_ureña_colon', 'Ruta: Ureña → Colón')}
							class="action-btn route"
						>
							<span class="icon">🛣️</span>
							<span class="label">Ureña → Colón</span>
						</button>

						<button
							type="button"
							on:click={() => cambiarEstado('accidentado')}
							class="action-btn accident"
						>
							<span class="icon">⚠️</span>
							<span class="label">Accidentado</span>
						</button>
					</div>
				</div>
			{:else}
				<div class="empty-state">
					<h2>No se encontraron datos del conductor</h2>
					<p>Por favor, verifica tu conexión o contacta al administrador.</p>
				</div>
			{/if}

			{#if errorMessage}
				<div class="notification {errorMessage.includes('actualizado') ? 'success' : 'error'}">
					{errorMessage}
					<button class="close-btn" on:click={() => error.set('')}>×</button>
				</div>
			{/if}
		</div>
	</main>
</div>


<style>
	/* Estilos base */
	:global(body) {
		margin: 0;
		padding: 0;
		font-family: 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
		color: #333;
		height: 100vh;
		overflow: hidden;
		background-color: #f5f7fa;
	}

	.dashboard-container {
		display: flex;
		flex-direction: column;
		height: 100vh;
	}

	/* Navbar fijo */
	.dashboard-nav {
		padding: 0.75rem 1.5rem;
		background-color: #2c3e50;
		color: white;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
		position: sticky;
		top: 0;
		z-index: 1000;
	}

	/* Contenido principal con scroll */
	.dashboard-content {
		flex: 1;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
		padding: 1rem;
		background-color: #f5f7fa;
	}

	.content-wrapper {
		max-width: 1200px;
		margin: 0 auto;
		padding: 1rem;
		box-sizing: border-box;
	}

	/* Paneles */
	.info-panel,
	.actions-panel {
		background: white;
		border-radius: 10px;
		padding: 1.5rem;
		margin-bottom: 1.5rem;
		box-shadow: 0 2px 15px rgba(0, 0, 0, 0.05);
		border: 1px solid #eaeaea;
	}

	.info-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.5rem;
		border-bottom: 1px solid #eee;
		padding-bottom: 1rem;
	}

	.info-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1rem;
	}

	.info-item {
		padding: 0.5rem 0;
	}

	.info-label {
		font-weight: 600;
		color: #666;
		display: inline-block;
		min-width: 80px;
	}

	/* Estado */
	.status-badge {
		padding: 0.5rem 1rem;
		border-radius: 20px;
		font-size: 0.9rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.status-badge.en-servicio {
		background-color: #e3f9e5;
		color: #28a745;
	}
	.status-badge.descanso {
		background-color: #fff8e1;
		color: #ffc107;
	}
	.status-badge.en-ruta {
		background-color: #e3f2fd;
		color: #1976d2;
	}
	.status-badge.accidentado {
		background-color: #ffebee;
		color: #dc3545;
	}

	/* Acciones */
	.actions-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 1rem;
		margin-top: 1.5rem;
	}

	.action-btn {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 1.5rem 1rem;
		border: none;
		border-radius: 8px;
		background-color: white;
		cursor: pointer;
		transition: all 0.3s ease;
		box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
	}

	.action-btn:hover {
		transform: translateY(-3px);
		box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
	}

	.action-btn .icon {
		font-size: 2rem;
		margin-bottom: 0.5rem;
	}

	.action-btn .label {
		font-weight: 500;
		text-align: center;
	}

	.action-btn.service {
		border: 2px solid #28a745;
		color: #28a745;
	}
	.action-btn.rest {
		border: 2px solid #ffc107;
		color: #ffc107;
	}
	.action-btn.route {
		border: 2px solid #1976d2;
		color: #1976d2;
	}
	.action-btn.accident {
		border: 2px solid #dc3545;
		color: #dc3545;
	}

	/* Notificación */
	.notification {
		position: fixed;
		bottom: 2rem;
		right: 2rem;
		padding: 1rem 1.5rem;
		border-radius: 8px;
		color: white;
		display: flex;
		align-items: center;
		justify-content: space-between;
		max-width: 400px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		animation: slideIn 0.3s ease-out;
		z-index: 1000;
	}

	.notification.success {
		background-color: #28a745;
	}
	.notification.error {
		background-color: #dc3545;
	}

	.close-btn {
		background: none;
		border: none;
		color: white;
		font-size: 1.25rem;
		cursor: pointer;
		margin-left: 1rem;
		padding: 0 0.5rem;
	}

	/* Loading */
	.loading-overlay {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 300px;
	}

	.spinner {
		width: 50px;
		height: 50px;
		border: 5px solid #f3f3f3;
		border-top: 5px solid #3498db;
		border-radius: 50%;
		animation: spin 1s linear infinite;
		margin-bottom: 1rem;
	}

	.empty-state {
		text-align: center;
		padding: 3rem;
		color: #666;
	}

	/* Badges */
	.badge-container {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		justify-content: flex-end;
		align-items: center;
	}

	.user-badge {
		background-color: #3498db;
		padding: 0.5rem 0.75rem;
		border-radius: 20px;
		font-size: 0.8rem;
		white-space: nowrap;
		color: white;
		font-weight: 500;
	}

	/* Animaciones */
	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}

	@keyframes slideIn {
		from {
			transform: translateX(100%);
			opacity: 0;
		}
		to {
			transform: translateX(0);
			opacity: 1;
		}
	}

	/* Responsive */
	@media (max-width: 768px) {
		.dashboard-nav {
			padding: 0.75rem 1rem;
		}

		.content-wrapper {
			padding: 0.5rem;
		}

		.info-panel,
		.actions-panel {
			padding: 1rem;
		}

		.actions-grid {
			grid-template-columns: 1fr 1fr;
		}

		.notification {
			bottom: 1rem;
			right: 1rem;
			left: 1rem;
			max-width: none;
		}
	}

	@media (max-width: 480px) {
		.actions-grid {
			grid-template-columns: 1fr;
		}

		.info-grid {
			grid-template-columns: 1fr;
		}

		.badge-container {
			justify-content: center;
		}
	}
</style>
