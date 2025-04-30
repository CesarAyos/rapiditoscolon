<script>
    import Lock from '../components/lock.svelte'
</script>

<nav class="navbar navbar-expand-lg bg-body-tertiary">
    <div class="container-fluid">
      <a class="navbar-brand" href="/auth/dashboard-conductor">Rapiditos Colón</a>
      <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
        <span class="navbar-toggler-icon"></span>
      </button>
      <div class="collapse navbar-collapse" id="navbarNav">
        <ul class="navbar-nav">
          <li class="nav-item">
            <a class="nav-link active" aria-current="page" href="/auth/dashboard-conductor/maps">Mapa</a>
          </li>
          <li class="nav-item">
            <a class="nav-link" href="/pasajeros">Central - Conductores</a>
          </li>
          <li class="nav-item">
            <a class="nav-link" href="/auth/dashboard-conductor/maps/admin">Monitoreo</a>
          </li>
          <li class="nav-item">
            <a class="nav-link" href="/gestion">Gestion</a>
          </li>
          <li class="nav-item">
            <Lock />
          </li>
          <li class="nav-item">
            <a class="nav-link disabled" aria-disabled="true"></a>
          </li>
        </ul>
      </div>
    </div>
  </nav>