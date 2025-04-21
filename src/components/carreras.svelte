<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '../components/supabase.js';
	import { protegerRuta } from './protegerRuta.js';

	let solicitudes: any[] = [];
	let carrerasOrganizadas: any[][] = [];
	let loading: boolean = true;
	let error: string | null = null;

	// Número de WhatsApp destino
	const numeroWhatsApp = '+5804165313465';

	// Organizar las solicitudes en carreras de 4 pasajeros
	function organizarCarreras() {
		const ordenadas = [...solicitudes].sort(
			(a, b) => new Date(a.hora_servicio).getTime() - new Date(b.hora_servicio).getTime()
		);

		const agrupadas: any[][] = [];
		let grupoActual: any[] = [];
		let horaReferencia: Date | null = null;

		ordenadas.forEach((solicitud) => {
			const horaSolicitud = new Date(solicitud.hora_servicio);

			if (
				!horaReferencia ||
				Math.abs((horaSolicitud.getTime() - horaReferencia.getTime()) / (1000 * 60)) > 30 ||
				grupoActual.length >= 4
			) {
				if (grupoActual.length > 0) {
					agrupadas.push(grupoActual);
				}

				grupoActual = [solicitud];
				horaReferencia = horaSolicitud;
			} else {
				grupoActual.push(solicitud);
			}
		});

		if (grupoActual.length > 0) {
			agrupadas.push(grupoActual);
		}

		return agrupadas;
	}

	async function cargarSolicitudes() {
		loading = true;
		error = null;

		try {
			const { data, error: supabaseError } = await supabase
				.from('solicitudes_servicio')
				.select('*')
				.order('hora_servicio', { ascending: true })
				.eq('estado', 'pendiente');

			if (supabaseError) throw supabaseError;

			solicitudes = data;
			carrerasOrganizadas = organizarCarreras();
		} catch (err: unknown) {
			console.error('Error cargando solicitudes:', err);
			error = err instanceof Error ? err.message : 'Error desconocido al cargar las solicitudes';
		} finally {
			loading = false;
		}
	}

	async function marcarComoCompletada(solicitudId: number) {
		try {
			const { error } = await supabase
				.from('solicitudes_servicio')
				.update({ estado: 'completada' })
				.eq('id', solicitudId);

			if (error) throw error;

			await cargarSolicitudes();
		} catch (err: unknown) {
			console.error('Error actualizando estado:', err);
			alert('No se pudo actualizar el estado de la solicitud');
		}
	}

	onMount(async () => {
		await protegerRuta();
		await cargarSolicitudes();
	});
</script>

<div class="container py-4">
	<div class="d-flex justify-content-between align-items-center mb-4">
		<div>
			<h1 class="h3 mb-0 text-primary">
				<i class="bi bi-speedometer2 me-2"></i>Panel de Gestión de Carreras
			</h1>
			<p class="text-muted mb-0">Organización de solicitudes de transporte</p>
		</div>
		<div class="d-flex gap-2">
			<button
				class="btn btn-outline-primary"
				on:click={cargarSolicitudes}
				aria-label="Actualizar solicitudes"
			>
				<i class="bi bi-arrow-clockwise me-1"></i> Actualizar
			</button>
		</div>
	</div>

	{#if loading}
		<div class="text-center py-5">
			<div class="spinner-border text-primary" style="width: 3rem; height: 3rem;" role="status">
				<span class="visually-hidden">Cargando...</span>
			</div>
			<p class="mt-3 text-muted">Cargando solicitudes...</p>
		</div>
	{:else if error}
		<div class="alert alert-danger d-flex align-items-center">
			<i class="bi bi-exclamation-triangle-fill me-2 fs-4"></i>
			<div>
				<h5 class="alert-heading mb-1">Error al cargar datos</h5>
				<p class="mb-0">{error}</p>
			</div>
		</div>
	{:else if carrerasOrganizadas.length === 0}
		<div class="alert alert-info d-flex align-items-center">
			<i class="bi bi-info-circle-fill me-2 fs-4"></i>
			<div>
				<h5 class="alert-heading mb-1">No hay solicitudes</h5>
				<p class="mb-0">No hay solicitudes pendientes en este momento.</p>
			</div>
		</div>
	{:else}
		<div class="accordion custom-accordion" id="carrerasAccordion">
			{#each carrerasOrganizadas as grupo, i}
				<div class="accordion-item mb-3 border-0 shadow-sm">
					<h2 class="accordion-header" id={`heading${i}`}>
						<button
							class="accordion-button d-flex align-items-center justify-content-between {i !== 0
								? 'collapsed'
								: ''}"
							type="button"
							data-bs-toggle="collapse"
							data-bs-target={`#collapse${i}`}
							aria-expanded={i === 0 ? 'true' : 'false'}
							aria-controls={`collapse${i}`}
						>
							<div class="d-flex align-items-center">
								<span class="badge bg-primary rounded-pill me-3">{grupo.length}/4</span>
								<div>
									<span class="fw-bold">Carrera #{i + 1}</span>
									<span class="text-muted ms-2 small">
										{new Date(grupo[0].hora_servicio).toLocaleString()}
									</span>
								</div>
							</div>
							<i class="bi bi-chevron-down accordion-arrow"></i>
						</button>
					</h2>
					<div
						id={`collapse${i}`}
						class="accordion-collapse collapse {i === 0 ? 'show' : ''}"
						aria-labelledby={`heading${i}`}
						data-bs-parent="#carrerasAccordion"
					>
						<div class="accordion-body p-0">
							<div class="list-group list-group-flush">
								{#each grupo as solicitud}
									<div class="list-group-item border-start-0 border-end-0 py-3">
										<div class="d-flex justify-content-between align-items-start">
											<div class="flex-grow-1">
												<div class="d-flex align-items-center mb-2">
													<h5 class="mb-0 me-2">
														{solicitud.usuario_nombre}
													</h5>
													<span class="badge bg-secondary rounded-pill">
														{solicitud.pasajeros}
														{solicitud.pasajeros === 1 ? 'pasajero' : 'pasajeros'}
													</span>
													{#if solicitud.lleva_maletas}
														<span class="badge bg-warning text-dark rounded-pill ms-2">
															<i class="bi bi-bag-check-fill me-1"></i>{solicitud.cantidad_maletas}
														</span>
													{/if}
												</div>
												<p class="mb-2 text-truncate">
													<i class="bi bi-geo-alt-fill text-primary me-1"></i>
													{solicitud.direccion_recogida}
												</p>
												<div class="d-flex align-items-center text-muted small">
													<i class="bi bi-clock-history me-1"></i>
													{new Date(solicitud.hora_servicio).toLocaleTimeString([], {
														hour: '2-digit',
														minute: '2-digit'
													})}
													{#if solicitud.notas}
														<span class="ms-3">
															<i class="bi bi-card-text me-1"></i>
															{solicitud.notas}
														</span>
													{/if}
												</div>
											</div>
											
										</div>
									</div>
								{/each}
							</div>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.custom-accordion {
		--bs-accordion-border-color: rgba(0, 0, 0, 0.08);
	}

	.accordion-button {
		background-color: #f8fafc;
		font-weight: 500;
		transition: all 0.2s ease;
	}

	.accordion-button:not(.collapsed) {
		background-color: #f0f7ff;
		color: #0d6efd;
		box-shadow: none;
	}

	.accordion-button:focus {
		box-shadow: none;
		border-color: rgba(0, 0, 0, 0.08);
	}

	.accordion-arrow {
		transition: transform 0.2s ease;
	}

	.accordion-button:not(.collapsed) .accordion-arrow {
		transform: rotate(180deg);
	}

	.list-group-item {
		transition: background-color 0.2s ease;
	}

	.list-group-item:hover {
		background-color: #f8fafc;
	}

	@media (max-width: 768px) {
		.d-flex.justify-content-between {
			flex-direction: column;
			gap: 1rem;
		}

		
	}
</style>
