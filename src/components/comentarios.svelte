<script lang="ts">
	import { supabase } from './supabase';
	import { onMount } from 'svelte';

	// Definición de tipos
	type TipoSugerencia = 'queja' | 'sugerencia' | 'felicitacion' | string;

	interface SugerenciaCliente {
		primernombre: string;
		primerapellido: string;
		telefono: string;
		sugerencia: string;
		tipo: TipoSugerencia;
		fecha_creacion: string;
		leido: boolean;
		id?: number; // Añadido para el key en el each
	}

	// Variables con tipos explícitos
	let sugerencias: SugerenciaCliente[] = [];
	let cargando: boolean = true;
	let error: string | null = null;

	onMount(async () => {
		await obtenerDatos();
	});

	async function obtenerDatos() {
		cargando = true;
		try {
			const { data, error: supabaseError } = await supabase
				.from('sugerencias_clientes')
				.select('primernombre, primerapellido, telefono, sugerencia, tipo, fecha_creacion, leido')
				.order('fecha_creacion', { ascending: false });

			if (supabaseError) throw supabaseError;
			sugerencias = data as SugerenciaCliente[];
		} catch (err) {
			console.error('Error obteniendo datos:', err);
			error = 'No se pudieron cargar las sugerencias. Por favor intente más tarde.';
		} finally {
			cargando = false;
		}
	}

	function formatearFecha(fecha: string): string {
		return new Date(fecha).toLocaleDateString('es-ES', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<div class="contenedor-sugerencias">
	<h1 class="titulo">Sugerencias de Clientes</h1>

	{#if error}
		<div class="error">{error}</div>
	{:else if cargando}
		<div class="estado cargando">Cargando sugerencias...</div>
	{:else}
		<div class="tabla-contenedor">
			<table>
				<thead>
					<tr>
						<th>Nombre</th>
						<th>Apellido</th>
						<th>Teléfono</th>
						<th>Sugerencia</th>
						<th>Tipo</th>
						<th>Fecha</th>
						<th>Estado</th>
					</tr>
				</thead>
				<tbody>
					{#each sugerencias as sugerencia (sugerencia.id)}
						<tr class={sugerencia.leido ? 'leido' : 'no-leido'}>
							<td data-label="Nombre">{sugerencia.primernombre}</td>
							<td data-label="Apellido">{sugerencia.primerapellido}</td>
							<td data-label="Teléfono">{sugerencia.telefono}</td>
							<td data-label="Sugerencia">{sugerencia.sugerencia}</td>
							<td data-label="Tipo">
								{#if sugerencia.tipo === 'queja'}
									<span class="tipo tipo-queja">Queja</span>
								{:else if sugerencia.tipo === 'sugerencia'}
									<span class="tipo tipo-sugerencia">Sugerencia</span>
								{:else if sugerencia.tipo === 'felicitacion'}
									<span class="tipo tipo-felicitacion">Felicitación</span>
								{:else}
									<span class="tipo">{sugerencia.tipo}</span>
								{/if}
							</td>
							<td data-label="Fecha">{formatearFecha(sugerencia.fecha_creacion)}</td>
							<td data-label="Estado">{sugerencia.leido ? 'Leído' : 'Nuevo'}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

<style>
	/* Estilos base */
	.contenedor-sugerencias {
		font-family: 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
		max-width: 1200px;
		margin: 0 auto;
		padding: 20px;
		color: #333;
	}

	.titulo {
		font-size: 2rem;
		font-weight: 600;
		color: #2c3e50;
		margin-bottom: 1.5rem;
		padding-bottom: 0.5rem;
		border-bottom: 2px solid #eee;
	}

	/* Estilos para la tabla */
	.tabla-contenedor {
		overflow-x: auto;
		border-radius: 8px;
		box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
		background: white;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		min-width: 600px;
	}

	th,
	td {
		padding: 12px 15px;
		text-align: left;
		border-bottom: 1px solid #e0e0e0;
	}

	th {
		background-color: #f8f9fa;
		font-weight: 600;
		color: #495057;
		text-transform: uppercase;
		font-size: 0.75rem;
		letter-spacing: 0.5px;
	}

	tr:hover {
		background-color: #f8f9fa;
	}

	.no-leido {
		background-color: #fff8e1;
	}

	.leido {
		background-color: white;
	}

	/* Tipos de sugerencia */
	.tipo {
		display: inline-block;
		padding: 4px 8px;
		border-radius: 4px;
		font-size: 0.75rem;
		font-weight: 600;
	}

	.tipo-queja {
		background-color: #ffebee;
		color: #c62828;
	}

	.tipo-sugerencia {
		background-color: #e8f5e9;
		color: #2e7d32;
	}

	.tipo-felicitacion {
		background-color: #e3f2fd;
		color: #1565c0;
	}

	/* Estados de carga y error */
	.estado {
		padding: 20px;
		text-align: center;
		font-size: 1rem;
	}

	.cargando {
		color: #666;
	}

	.error {
		color: #d32f2f;
		background-color: #ffebee;
		padding: 15px;
		border-radius: 4px;
		margin: 20px 0;
	}

	/* Responsive */
	@media (max-width: 768px) {
		.contenedor-sugerencias {
			padding: 10px;
		}

		.titulo {
			font-size: 1.5rem;
		}

		th,
		td {
			padding: 8px 10px;
		}

		/* Ocultar columnas menos importantes en móviles */
		td:nth-child(4), th:nth-child(4), /* Teléfono */
      td:nth-child(6), th:nth-child(6) {
			/* Fecha */
			display: none;
		}
	}

	@media (max-width: 480px) {
		/* Mostrar como tarjetas en móviles muy pequeños */
		table,
		thead,
		tbody,
		th,
		td,
		tr {
			display: block;
		}

		thead tr {
			position: absolute;
			top: -9999px;
			left: -9999px;
		}

		tr {
			margin-bottom: 15px;
			border: 1px solid #ddd;
			border-radius: 8px;
			padding: 10px;
		}

		td {
			border: none;
			border-bottom: 1px solid #eee;
			position: relative;
			padding-left: 50%;
		}

		td:before {
			position: absolute;
			top: 12px;
			left: 10px;
			width: 45%;
			padding-right: 10px;
			white-space: nowrap;
			font-weight: 600;
			content: attr(data-label);
		}

		/* Mostrar todas las columnas en modo tarjeta */
		td:nth-child(4),
		td:nth-child(6) {
			display: block;
		}
	}
</style>
