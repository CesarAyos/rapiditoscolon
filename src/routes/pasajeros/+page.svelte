<script>
	import Carreras from '../../components/carreras.svelte';
	import Estado from '../../components/estado.svelte';
	import Pasajeromanual from '../../components/pasajeromanual.svelte';
	import { protegerRuta } from '../../components/protegerRuta';
	import { onMount } from 'svelte';
	import Turnosasignados from '../../components/turnosasignados.svelte';
	import UltimosUrena from '../../components/ultimosUrena.svelte';
	import CombustibleControl from '../../components/CombustibleControl.svelte';
	import Parrilla from '../../components/parrilla.svelte';
	import Navbar from '../../components/navbar.svelte';
	

	onMount(() => {
		protegerRuta();
	});
</script>

<div class="container-fluid p-4 bg-light min-vh-100">
	<Navbar />
	<!-- Header -->
	<header class="mb-5 text-center">
		<h1 class="display-5 fw-bold text-primary">Panel de Control</h1>
		<p class="lead text-muted">Gestión integral de transporte</p>
	</header>

	<!-- Botón de actualización -->
	<div class="d-flex justify-content-center mb-4">
		<button 
			class="btn btn-primary btn-lg shadow-sm" 
			on:click={() => window.location.reload()}
		>
			<i class="bi bi-arrow-clockwise me-2"></i>
			Actualizar datos de pasajeros
		</button>
	</div>


	<!-- Grid de componentes -->
	<div class="row g-4">
		<!-- Pasajero Manual -->
		<div class="col-lg-6">
			<div class="card h-100 shadow-sm">
				<div class="card-header bg-primary text-white">
					<h3 class="h5 mb-0">Gestión de Pasajeros</h3>
				</div>
				<div class="card-body">
					<Pasajeromanual />
				</div>
			</div>
		</div>

		<!-- Carreras -->
		<div class="col-lg-6">
			<div class="card h-100 shadow-sm">
				<div class="card-header bg-primary text-white">
					<h3 class="h5 mb-0">Gestión de Carreras</h3>
				</div>
				<div class="card-body">
					<Carreras />
				</div>
			</div>
		</div>

		<div class="col-lg-6">
			<div class="card h-100 shadow-sm">
				<div class="card-header bg-primary text-white">
					<h3 class="h5 mb-0">Gestión de Turnos</h3>
				</div>
				<div class="card-body">
					<Turnosasignados />
				</div>
			</div>
		</div>

		

		<!-- Estado -->
		<div class="col-lg-6">
			<div class="card h-100 shadow-sm">
				<div class="card-header bg-primary text-white">
					<h3 class="h5 mb-0">Estado del Sistema</h3>
				</div>
				<div class="card-body">
					<Estado />
				</div>
			</div>
		</div>
		<div class="col-lg-6">
			<div class="card h-100 shadow-sm">
				<div class="card-header bg-primary text-white">
					<h3 class="h5 mb-0">Estado del Sistema</h3>
				</div>
				<div class="card-body">
					<UltimosUrena />
				</div>
			</div>
		</div>
		<div class="col-lg-6">
			<div class="card h-100 shadow-sm">
				<div class="card-header bg-primary text-white">
					<h3 class="h5 mb-0">Estado del Sistema</h3>
				</div>
				<div class="card-body">
					<CombustibleControl />
				</div>
			</div>
		</div>
		<div class="col-lg-6">
			<div class="card h-100 shadow-sm">
				<div class="card-header bg-primary text-white">
					<h3 class="h5 mb-0">Estado del Sistema</h3>
				</div>
				<div class="card-body">
					<Parrilla />
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	.card {
		border-radius: 0.5rem;
		border: none;
		transition: transform 0.2s;
	}
	
	.card:hover {
		transform: translateY(-2px);
	}
	
	.btn-primary {
		border-radius: 0.5rem;
		padding: 0.5rem 1.5rem;
		font-weight: 500;
	}
</style>