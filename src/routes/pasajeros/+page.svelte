<script>
	import Carreras from '../../components/carreras.svelte';
	import Pasajeromanual from '../../components/pasajeromanual.svelte';
</script>

<div class="d-flex justify-content-center m-4">
	<button class="btn btn-primary" on:click={() => window.location.reload()}>
		<span class="">Actualizar para ver pasajeros de aplicación</span>
	</button>
</div>

<div>
	<Pasajeromanual />
</div>
<div>
	<Carreras />
</div>
