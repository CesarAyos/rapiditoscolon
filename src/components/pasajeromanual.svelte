<script lang="ts">
	import { supabase } from '../components/supabase.js';
	import { onMount } from 'svelte';

	// Definición de tipos
	type EstadoPasajero = 'pendiente' | 'confirmado' | 'buscado';

	interface Pasajero {
		id: string;
		nombre: string;
		apellido: string;
		telefono: string;
		direccion: string | null;
		hora_busqueda: string;
		control_reporto: string | null;
		estado: EstadoPasajero;
		created_at: string;
		confirmado_por?: string | null;
		buscado_por?: string | null;
	}

	interface FormPasajero {
		nombre: string;
		apellido: string;
		telefono: string;
		direccion: string;
		hora_busqueda: string;
		control_reporto: string;
		estado: EstadoPasajero;
	}

	// Estados del componente
	let showModal: boolean = false;
	let loading: boolean = false;
	let message: string = '';
	let controlUsuarioActual: string | null = null;

	// Formulario
	let form: FormPasajero = {
		nombre: '',
		apellido: '',
		telefono: '',
		direccion: '',
		hora_busqueda: '',
		control_reporto: '',
		estado: 'pendiente'
	};

	// Listas de pasajeros
	let pasajeros: Pasajero[] = [];
	let pasajerosFiltrados: Pasajero[] = [];
	let filtroEstado: EstadoPasajero = 'pendiente';

	// Cargar pasajeros y datos del usuario al montar el componente
	onMount(async () => {
		await obtenerControlUsuario();
		await cargarPasajeros();
	});

	// Función para obtener el control del usuario actual
	async function obtenerControlUsuario(): Promise<void> {
		loading = true;
		try {
			// Obtener el usuario autenticado
			const { data: { user } } = await supabase.auth.getUser();
			
			if (user) {
				// Buscar el conductor asociado a este usuario
				const { data: conductorData, error } = await supabase
					.from('conductor')
					.select('control')
					.eq('user_id', user.id)
					.single();
				
				if (conductorData) {
					controlUsuarioActual = conductorData.control;
				} else if (error) {
					console.error('Error al cargar datos del conductor:', error);
					message = 'No se pudo obtener su información de conductor';
				}
			} else {
				message = 'No hay usuario autenticado';
			}
		} catch (error) {
			console.error('Error al obtener usuario:', error);
			message = 'Error al cargar información del usuario';
		}
		loading = false;
	}

	// Función para cargar pasajeros
	async function cargarPasajeros(): Promise<void> {
		loading = true;
		const { data, error } = await supabase
			.from('pasajeros')
			.select('*');

		if (error) {
			message = `Error cargando pasajeros: ${error.message}`;
			console.error(message);
		} else if (data) {
			pasajeros = data;
			filtrarPasajeros();
		}
		loading = false;
	}

	// Filtrar pasajeros según estado
	function filtrarPasajeros(): void {
		pasajerosFiltrados = pasajeros.filter((p) => p.estado === filtroEstado);
	}

	function convertirHoraManual(hora: string): string {
		if (!hora) return '';
		
		const [horasStr, minutos] = hora.split(':');
		const horas = horasStr.padStart(2, '0');
		const horaNormalizada = `${horas}:${minutos}`;

		const fecha = new Date();
		fecha.setHours(parseInt(horas), parseInt(minutos), 0, 0);
		
		return fecha.toISOString();
	}

	// Guardar nuevo pasajero
	async function guardarPasajero(): Promise<void> {
		if (!form.nombre || !form.apellido || !form.telefono || !form.hora_busqueda) {
			message = 'Por favor complete todos los campos requeridos';
			return;
		}

		if (!/^([0-9]|0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/.test(form.hora_busqueda)) {
			message = 'Formato de hora inválido. Use H:MM o HH:MM (ej: 8:30 o 14:30)';
			return;
		}

		loading = true;

		const horaCompleta = convertirHoraManual(form.hora_busqueda);

		const { error } = await supabase.from('pasajeros').insert([
			{
				...form,
				hora_busqueda: horaCompleta,
				direccion: form.direccion || null,
				control_reporto: form.control_reporto || null
			}
		]);

		if (error) {
			message = `Error guardando pasajero: ${error.message}`;
			console.error(message);
		} else {
			message = 'Pasajero registrado exitosamente';
			form = {
				nombre: '',
				apellido: '',
				telefono: '',
				direccion: '',
				hora_busqueda: '',
				control_reporto: '',
				estado: 'pendiente'
			};
			showModal = false;
			await cargarPasajeros();
		}
		loading = false;
	}

	// Cambiar estado del pasajero
	async function cambiarEstado(pasajero: Pasajero): Promise<void> {
		if (pasajero.estado === 'buscado') return;
		if (!controlUsuarioActual) {
			message = 'No se pudo identificar su control de conductor';
			return;
		}

		loading = true;
		const nuevoEstado: EstadoPasajero = pasajero.estado === 'pendiente' ? 'confirmado' : 'buscado';

		const updateData: any = { 
			estado: nuevoEstado 
		};

		// Agregar quién realizó la acción
		if (nuevoEstado === 'confirmado') {
			updateData.confirmado_por = controlUsuarioActual;
		} else if (nuevoEstado === 'buscado') {
			updateData.buscado_por = controlUsuarioActual;
		}

		const { error } = await supabase
			.from('pasajeros')
			.update(updateData)
			.eq('id', pasajero.id);

		if (error) {
			message = `Error actualizando estado: ${error.message}`;
			console.error(message);
		} else {
			await cargarPasajeros();
		}
		loading = false;
	}

	// Resto de funciones sin cambios...
	function ordenarPorFecha(a: Pasajero, b: Pasajero): number {
		try {
			const fechaA = new Date(a.hora_busqueda).getTime();
			const fechaB = new Date(b.hora_busqueda).getTime();
			return fechaA - fechaB;
		} catch (error) {
			console.error("Error al ordenar por fecha:", error);
			return 0;
		}
	}

	function agruparPorDia(pasajeros: Pasajero[]): Record<string, Pasajero[]> {
		return pasajeros.reduce((acc: Record<string, Pasajero[]>, pasajero) => {
			const fecha = new Date(pasajero.hora_busqueda);
			const dia = fecha.toLocaleDateString('es-ES', {
				day: '2-digit',
				month: '2-digit',
				year: 'numeric'
			});
			
			if (!acc[dia]) acc[dia] = [];
			acc[dia].push(pasajero);
			return acc;
		}, {});
	}

	function formatHora(fechaISO: string): string {
		try {
			const fecha = new Date(fechaISO);
			if (isNaN(fecha.getTime())) return '-';
			const horas = fecha.getHours();
			const minutos = fecha.getMinutes().toString().padStart(2, '0');
			return `${horas}:${minutos}`;
		} catch {
			return '-';
		}
	}

	function cambiarFiltro(nuevoFiltro: EstadoPasajero): void {
		filtroEstado = nuevoFiltro;
		filtrarPasajeros();
	}

	function handleKeyDown(event: KeyboardEvent, pasajero: Pasajero): void {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			cambiarEstado(pasajero);
		}
	}
</script>

<!-- Resto del template (igual que antes) -->
<div class="container">
	{#if message}
		<div class="notification {message.includes('Error') ? 'error' : 'success'}">
			{message}
			<button on:click={() => (message = '')} aria-label="Cerrar notificación" class="close-btn">
				&times;
			</button>
		</div>
	{/if}

	<button on:click={() => (showModal = true)} class="btn" disabled={loading}>
		{loading ? 'Cargando...' : 'Pasajero de forma manual'}
	</button>

	<div class="filtros">
		<button
			class:active={filtroEstado === 'pendiente'}
			on:click={() => cambiarFiltro('pendiente')}
			disabled={loading}
		>
			Pendientes
		</button>
		<button
			class:active={filtroEstado === 'confirmado'}
			on:click={() => cambiarFiltro('confirmado')}
			disabled={loading}
		>
			Confirmados
		</button>
		<button
			class:active={filtroEstado === 'buscado'}
			on:click={() => cambiarFiltro('buscado')}
			disabled={loading}
		>
			Buscados
		</button>
	</div>

	{#if showModal}
		<div class="modal">
			<div class="modal-content">
				<button on:click={() => (showModal = false)} aria-label="Cerrar modal" class="close">
					&times;
				</button>
				<h2>Registrar Pasajero Manual</h2>

				<form on:submit|preventDefault={guardarPasajero}>
					<div class="form-group">
						<label for="nombre">Nombre*:</label>
						<input type="text" id="nombre" bind:value={form.nombre} required />
					</div>

					<div class="form-group">
						<label for="apellido">Apellido*:</label>
						<input type="text" id="apellido" bind:value={form.apellido} required />
					</div>

					<div class="form-group">
						<label for="telefono">Teléfono*:</label>
						<input type="tel" id="telefono" bind:value={form.telefono} required />
					</div>

					<div class="form-group">
						<label for="direccion">Dirección:</label>
						<input type="text" id="direccion" bind:value={form.direccion} />
					</div>

					<div class="form-group">
						<label for="hora_busqueda">Hora de Búsqueda*:</label>
						<input
							type="text"
							bind:value={form.hora_busqueda}
							placeholder="Hora (H:MM o HH:MM)"
							pattern="([0-9]|0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]"
							title="Formato: H:MM o HH:MM (ej: 8:30 o 14:30)"
							required
						/>
					</div>

					<div class="form-group">
						<label for="control_reporto">Control que lo reportó:</label>
						<input type="text" id="control_reporto" bind:value={form.control_reporto} />
					</div>

					<button type="submit" class="btn-submit" disabled={loading}>
						{loading ? 'Guardando...' : 'Guardar'}
					</button>
				</form>
			</div>
		</div>
	{/if}

	<div class="pasajeros-list">
		<h2>
			Pasajeros {filtroEstado === 'pendiente'
				? 'Pendientes'
				: filtroEstado === 'confirmado'
					? 'Confirmados'
					: 'Buscados'}
		</h2>
	
		{#if loading && pasajerosFiltrados.length === 0}
			<p class="mensaje-vacio">Cargando pasajeros...</p>
		{:else if pasajerosFiltrados.length === 0}
			<p class="mensaje-vacio">
				{filtroEstado === 'pendiente'
					? 'No hay pasajeros pendientes'
					: filtroEstado === 'confirmado'
						? 'No hay pasajeros confirmados'
						: 'No hay pasajeros buscados'}
			</p>
		{:else}
			{#each Object.entries(agruparPorDia(pasajerosFiltrados)) as [dia, grupo]}
				<div class="grupo-dia">
					<h3>{dia}</h3>
		
					<table>
						<thead>
							<tr>
								<th>Nombre</th>
								<th>Apellido</th>
								<th>Teléfono</th>
								<th>Dirección</th>
								<th>Hora Búsqueda</th>
								<th>Reportado por</th>
								<th>Estado</th>
								<th>Buscado por</th>
							</tr>
						</thead>
						<tbody>
							{#each grupo.sort(ordenarPorFecha) as pasajero}
								<tr
									on:click={() => cambiarEstado(pasajero)}
									on:keydown={(e) => handleKeyDown(e, pasajero)}
									class:clickable={pasajero.estado !== 'buscado'}
									class:buscado={pasajero.estado === 'buscado'}
									tabindex={pasajero.estado !== 'buscado' ? 0 : undefined}
									role={pasajero.estado !== 'buscado' ? 'button' : undefined}
								>
									<td>{pasajero.nombre}</td>
									<td>{pasajero.apellido}</td>
									<td>{pasajero.telefono}</td>
									<td>{pasajero.direccion || '-'}</td>
									<td>{formatHora(pasajero.hora_busqueda)}</td>
									<td>{pasajero.control_reporto || '-'}</td>
									<td class:estado-pendiente={pasajero.estado === 'pendiente'}
										class:estado-confirmado={pasajero.estado === 'confirmado'}
										class:estado-buscado={pasajero.estado === 'buscado'}>
										{pasajero.estado.toUpperCase()}
									</td>
									<td>
										{#if pasajero.estado === 'confirmado' && pasajero.confirmado_por}
											Control: {pasajero.confirmado_por}
										{:else if pasajero.estado === 'buscado' && pasajero.buscado_por}
											Control: {pasajero.buscado_por}
										{:else}
											-
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/each}
		{/if}
	</div>
</div>

<style>
	/* Estilos anteriores se mantienen igual */
	:global(body) {
		font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
		margin: 0;
		padding: 0;
		background-color: #f5f5f5;
		color: #333;
	}

	.container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 20px;
		background-color: white;
		box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
		border-radius: 8px;
		margin-top: 20px;
	}

	.btn {
		background-color: #4caf50;
		color: white;
		padding: 10px 20px;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 16px;
		transition: background-color 0.3s;
		margin-bottom: 20px;
	}

	.btn:hover:not(:disabled) {
		background-color: #45a049;
	}

	.btn:disabled {
		background-color: #cccccc;
		cursor: not-allowed;
	}

	.notification {
		padding: 15px;
		margin-bottom: 20px;
		border-radius: 4px;
		position: relative;
	}

	.notification.success {
		background-color: #dff0d8;
		color: #3c763d;
		border: 1px solid #d6e9c6;
	}

	.notification.error {
		background-color: #f2dede;
		color: #a94442;
		border: 1px solid #ebccd1;
	}

	.close-btn {
		position: absolute;
		right: 15px;
		top: 50%;
		transform: translateY(-50%);
		background: none;
		border: none;
		font-size: 20px;
		cursor: pointer;
		padding: 0;
	}

	.filtros {
		display: flex;
		gap: 10px;
		margin-bottom: 20px;
		flex-wrap: wrap;
	}

	.filtros button {
		padding: 8px 16px;
		border: 1px solid #ddd;
		background: #f5f5f5;
		cursor: pointer;
		border-radius: 4px;
		transition: all 0.3s;
	}

	.filtros button.active {
		background: #4caf50;
		color: white;
		border-color: #4caf50;
	}

	.filtros button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.modal {
		position: fixed;
		z-index: 1000;
		left: 0;
		top: 0;
		width: 100%;
		height: 100%;
		background-color: rgba(0, 0, 0, 0.5);
		display: flex;
		justify-content: center;
		align-items: center;
	}

	.modal-content {
		background-color: white;
		padding: 25px;
		border-radius: 8px;
		width: 90%;
		max-width: 600px;
		max-height: 90vh;
		overflow-y: auto;
		box-shadow: 0 0 20px rgba(0, 0, 0, 0.2);
		position: relative;
	}

	.close {
		position: absolute;
		right: 20px;
		top: 15px;
		font-size: 24px;
		font-weight: bold;
		color: #aaa;
		cursor: pointer;
		background: none;
		border: none;
	}

	.form-group {
		margin-bottom: 15px;
	}

	.form-group label {
		display: block;
		margin-bottom: 5px;
		font-weight: 600;
		color: #555;
	}

	.form-group input {
		width: 100%;
		padding: 10px;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-size: 16px;
	}

	.form-group input:focus {
		border-color: #4caf50;
		outline: none;
		box-shadow: 0 0 5px rgba(76, 175, 80, 0.3);
	}

	.btn-submit {
		background-color: #2196f3;
		color: white;
		padding: 12px 20px;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 16px;
		width: 100%;
		margin-top: 10px;
		transition: background-color 0.3s;
	}

	.btn-submit:hover:not(:disabled) {
		background-color: #0b7dda;
	}

	.btn-submit:disabled {
		background-color: #cccccc;
		cursor: not-allowed;
	}

	.pasajeros-list {
		margin-top: 30px;
	}

	.pasajeros-list h2 {
		color: #333;
		border-bottom: 2px solid #4caf50;
		padding-bottom: 10px;
		margin-bottom: 20px;
	}

	.grupo-dia {
		margin-bottom: 30px;
	}

	.grupo-dia h3 {
		background-color: #f5f5f5;
		padding: 10px;
		border-left: 4px solid #4caf50;
		margin-bottom: 10px;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		margin-bottom: 20px;
	}

	th,
	td {
		padding: 12px 15px;
		text-align: left;
		border-bottom: 1px solid #ddd;
	}

	th {
		background-color: #f8f8f8;
		font-weight: 600;
	}

	tr.clickable:hover {
		background-color: #f9f9f9;
		cursor: pointer;
	}

	tr.buscado {
		opacity: 0.7;
	}

	.estado-pendiente {
		color: #ff9800;
		font-weight: bold;
	}

	.estado-confirmado {
		color: #2196f3;
		font-weight: bold;
	}

	.estado-buscado {
		color: #4caf50;
		font-weight: bold;
		text-decoration: line-through;
	}

	.mensaje-vacio {
		text-align: center;
		padding: 30px;
		color: #666;
		font-style: italic;
		background-color: #f9f9f9;
		border-radius: 4px;
	}

	/* Estilo para la nueva columna */
	table th:nth-child(8),
	table td:nth-child(8) {
		max-width: 150px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	@media (max-width: 768px) {
		.container {
			padding: 15px;
		}

		table {
			display: block;
			overflow-x: auto;
		}

		.modal-content {
			width: 95%;
			padding: 15px;
		}
	}
</style>