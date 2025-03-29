<script lang="ts">
	import { supabase } from '../../../components/supabase';
	import { onMount } from 'svelte';
	import { writable } from 'svelte/store';
	import Lock from '../../../components/lock.svelte';

	// Tipos
	type Conductor = {
		id: number;
		created_at?: string;
		nombre: string;
		placa: string;
		email: string;
		control: string;
		propiedad: string;
		telefono?: string | null;
	};

	type EstadoConductor = {
		id: number;
		created_at?: string;
		conductor_id: number;
		estado: string;
		descripcion?: string | null;
	};

	type Database = {
		public: {
			Tables: {
				conductor: {
					Row: Conductor;
					Insert: Omit<Conductor, 'id' | 'created_at'>;
					Update: Partial<Omit<Conductor, 'id'>>;
				};
				estado_conductor: {
					Row: EstadoConductor;
					Insert: Omit<EstadoConductor, 'id' | 'created_at'>;
					Update: Partial<Omit<EstadoConductor, 'id'>>;
				};
			};
		};
	};

	// Stores
	const conductor = writable<Conductor | null>(null);
	const estadoActual = writable<string>('Descanso');
	const error = writable<string>('');
	const isLoading = writable<boolean>(false);
	const session = writable<any>(null);

	// Variables reactivas
	let conductorData: Conductor | null = null;
	let currentEstado: string = 'Descanso';
	let errorMessage: string = '';
	let loading: boolean = false;
	let currentSession: any = null;

	// Suscripciones
	conductor.subscribe((value) => (conductorData = value));
	estadoActual.subscribe((value) => (currentEstado = value));
	error.subscribe((value) => (errorMessage = value));
	isLoading.subscribe((value) => (loading = value));
	session.subscribe((value) => (currentSession = value));

	// Obtener sesión activa
	const getSession = async () => {
		const { data, error } = await supabase.auth.getSession();
		if (error) {
			console.error('Error obteniendo sesión:', error);
			return null;
		}
		session.set(data.session);
		return data.session;
	};

	// Obtener conductor basado en el email del usuario autenticado
	const obtenerConductor = async () => {
		isLoading.set(true);
		error.set(''); // Limpia errores previos
		try {
			const session = await getSession();
			if (!session?.user?.email) {
				throw new Error('No hay usuario autenticado');
			}

			const { data, error: sbError } = await supabase
				.from('conductor')
				.select('*')
				.eq('email', session.user.email)
				.single();

			if (sbError) throw sbError;
			if (!data) {
				throw new Error(`No se encontró conductor con email: ${session.user.email}`);
			}

			conductor.set(data);
			await obtenerUltimoEstado(data.id);
		} catch (err) {
			console.error('Error en obtenerConductor:', err);
			error.set(err instanceof Error ? err.message : 'Error desconocido');
			conductor.set(null); // Asegura que se limpie
		} finally {
			isLoading.set(false);
		}
	};

	// Obtener último estado (se mantiene igual)
	const obtenerUltimoEstado = async (conductorId: number) => {
		try {
			const { data, error: sbError } = await supabase
				.from('estado_conductor')
				.select('*')
				.eq('conductor_id', conductorId)
				.order('updated_at', { ascending: false }) // Usar updated_at en lugar de created_at
				.limit(1);

			if (sbError) throw sbError;
			if (data?.[0]?.estado) {
				estadoActual.set(data[0].estado);
			}
		} catch (err) {
			error.set('Error obteniendo estado actual');
			console.error(err);
		}
	};

	// Cambiar estado (se mantiene igual)
	const cambiarEstado = async (nuevoEstado: string, descripcion: string = '') => {
		if (!conductorData) {
			error.set('No hay datos del conductor');
			return;
		}

		isLoading.set(true);
		try {
			// Primero buscamos si existe un registro de estado para este conductor
			const { data: estadoExistente, error: searchError } = await supabase
				.from('estado_conductor')
				.select('id')
				.eq('conductor_id', conductorData.id)
				.order('created_at', { ascending: false })
				.limit(1)
				.single();

			if (searchError && searchError.code !== 'PGRST116') {
				// Ignorar error "No rows found"
				throw searchError;
			}

			if (estadoExistente?.id) {
				// Si existe, actualizamos el registro existente
				const { error: updateError } = await supabase
					.from('estado_conductor')
					.update({
						estado: nuevoEstado,
						descripcion: descripcion || null,
						updated_at: new Date().toISOString() // Opcional: añadir campo de actualización
					})
					.eq('id', estadoExistente.id);

				if (updateError) throw updateError;
			} else {
				// Si no existe, creamos un nuevo registro
				const { error: insertError } = await supabase.from('estado_conductor').insert({
					conductor_id: conductorData.id,
					estado: nuevoEstado,
					descripcion: descripcion || null
				});

				if (insertError) throw insertError;
			}

			estadoActual.set(nuevoEstado);
			error.set(`Estado actualizado: ${nuevoEstado}`);
			setTimeout(() => error.set(''), 3000);
		} catch (err) {
			error.set('Error cambiando estado');
			console.error(err);
		} finally {
			isLoading.set(false);
		}
	};

	// Inicialización
	onMount(async () => {
		await getSession();
		await obtenerConductor();

		// Escuchar cambios en la autenticación
		supabase.auth.onAuthStateChange((event, session) => {
			if (event === 'SIGNED_IN') {
				obtenerConductor();
			} else if (event === 'SIGNED_OUT') {
				conductor.set(null);
				estadoActual.set('Descanso');
			}
		});
	});
</script>

<div class="dashboard-container">
	<!-- Navbar fijo en la parte superior -->
	<nav class="dashboard-nav">
		<div class="nav-user">
			{#if conductorData}
				<div class="badge-container">
					<span class="user-badge text-uppercase">Control: {conductorData.control}</span>
					<span class="user-badge text-uppercase"
						>{conductorData.propiedad}: {conductorData.nombre}</span
					>
					<span class="user-badge text-uppercase">Placa: {conductorData.placa}</span>
					<a href="/auth/dashboard-conductor/maps" class="user-badge text-uppercase text-white text-decoration-none">maps</a>
					<Lock />
				</div>
			{:else}
				<span class="user-name">No autenticado</span>
			{/if}
		</div>
	</nav>
	<!-- Contenido principal con scroll -->
	<main class="dashboard-content">
		<div class="content-wrapper">
			{#if loading}
				<div class="loading-overlay">
					<div class="spinner"></div>
					<p>Cargando datos...</p>
				</div>
			{:else if conductorData}
				<!-- Panel de información -->
				<div class="info-panel">
					<div class="info-header">
						<h2>Estado Actual</h2>
						<div class="status-badge {currentEstado.toLowerCase().replace(' ', '-')}">
							{currentEstado}
						</div>
					</div>
				</div>

				<!-- Panel de acciones -->
				<div class="actions-panel">
					<h3>Cambiar Estado</h3>
					<div class="actions-grid">
						<button on:click={() => cambiarEstado('En servicio')} class="action-btn service">
							<span class="icon">🚕</span>
							<span class="label">En Servicio</span>
						</button>

						<button on:click={() => cambiarEstado('Descanso')} class="action-btn rest">
							<span class="icon">🛌</span>
							<span class="label">Descanso</span>
						</button>

						<button
							on:click={() => cambiarEstado('En ruta', 'Ruta: Colón → Ureña')}
							class="action-btn route"
						>
							<span class="icon">🛣️</span>
							<span class="label">Colón → Ureña</span>
						</button>

						<button
							on:click={() => cambiarEstado('En ruta', 'Ruta: Ureña → Colón')}
							class="action-btn route"
						>
							<span class="icon">🛣️</span>
							<span class="label">Ureña → Colón</span>
						</button>

						<button on:click={() => cambiarEstado('Accidentado')} class="action-btn accident">
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

			<!-- Notificación flotante -->
			{#if errorMessage}
				<div class="notification {errorMessage.includes('actualizado') ? 'success' : 'error'}">
					{errorMessage}
					<button class="close-btn" on:click={() => (errorMessage = '')}>×</button>
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
		overflow: hidden; /* Evita el doble scroll */
	}

	.dashboard-container {
		display: flex;
		flex-direction: column;
		height: 100vh;
	}

	/* Navbar fijo */
	.dashboard-nav {
		padding: 0.5rem 1rem;
		background-color: #2c3e50;
		color: white;
	}

	/* Contenido principal con scroll */
	.dashboard-content {
		flex: 1;
		overflow-y: auto; /* Habilita el scroll vertical */
		-webkit-overflow-scrolling: touch; /* Mejor scroll en iOS */
	}

	.content-wrapper {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem;
		box-sizing: border-box;
	}

	/* Resto de estilos (igual que antes) */
	.nav-brand {
		font-size: 1.5rem;
		font-weight: 600;
	}

	.nav-user {
		display: flex;
		justify-content: flex-end;
		width: 100%;
	}

	.user-name {
		font-weight: 500;
	}

	.user-badge {
		background-color: #3498db;
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		font-size: 0.75rem;
		white-space: nowrap;
	}

	.info-panel,
	.actions-panel {
		background: white;
		border-radius: 8px;
		padding: 1.5rem;
		margin-bottom: 2rem;
		box-shadow: 0 2px 15px rgba(0, 0, 0, 0.05);
	}

	.info-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.5rem;
		border-bottom: 1px solid #eee;
		padding-bottom: 1rem;
	}

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

	.user-info {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: 1rem;
	}

	.info-item {
		margin-bottom: 0.5rem;
	}

	.info-label {
		font-weight: 600;
		color: #666;
		margin-right: 0.5rem;
	}

	.actions-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
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

	.badge-container {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		justify-content: flex-end;
		align-items: center;
	}

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
			padding: 1rem;
		}

		.content-wrapper {
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

		.nav-user {
			flex-direction: column;
			gap: 0.5rem;
			align-items: flex-end;
		}
	}
</style>
