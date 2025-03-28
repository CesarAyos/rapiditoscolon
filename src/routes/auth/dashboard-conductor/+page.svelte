<script>
	import Lock from "../../../components/lock.svelte";


  // Datos del conductor
  let conductor = {
    nombre: "Carlos Mendoza",
    rating: 4.8,
    viajes: 124,
    vehiculo: "Toyota Corolla 2022",
    placa: "ABC-123"
  };

  // Viajes programados
  let viajes = [
    { id: 1, pasajero: "Ana López", hora: "08:30 AM", destino: "Aeropuerto", estado: "confirmado" },
    { id: 2, pasajero: "Juan Pérez", hora: "11:15 AM", destino: "Centro Comercial", estado: "pendiente" },
    { id: 3, pasajero: "María García", hora: "03:45 PM", destino: "Estación Central", estado: "confirmado" }
  ];

  // Estado del conductor
  let disponible = true;
  let ubicacionActual = "Av. Principal #456";

  function toggleDisponibilidad() {
    disponible = !disponible;
  }
</script>

<Lock />

<div class="wrapper">
  <div class="dashboard-container">
    <!-- Header -->
    <header class="dashboard-header">
      <h1>👋 Hola, {conductor.nombre.split(" ")[0]}</h1>
      <div class="status-badge {disponible ? 'available' : 'busy'}">
        {disponible ? 'Disponible' : 'En viaje'}
      </div>
    </header>

    <!-- Estadísticas -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon">⭐</div>
        <div class="stat-value">{conductor.rating}</div>
        <div class="stat-label">Rating</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">🚕</div>
        <div class="stat-value">{conductor.viajes}</div>
        <div class="stat-label">Viajes</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">📱</div>
        <div class="stat-value">24</div>
        <div class="stat-label">Solicitudes</div>
      </div>
    </div>

    <!-- Control de disponibilidad -->
    <div class="control-panel">
      <button 
        class="toggle-button {disponible ? 'active' : ''}" 
        on:click={toggleDisponibilidad}
      >
        {disponible ? '🔛 Disponible' : '⛔ Ocupado'}
      </button>
      <div class="location">
        📍 {ubicacionActual}
      </div>
    </div>

    <!-- Lista de viajes -->
    <div class="section-title">
      <h2>🚦 Viajes Programados</h2>
      <span class="badge">{viajes.length}</span>
    </div>

    <div class="trips-list">
      {#each viajes as viaje}
        <div class="trip-card {viaje.estado}">
          <div class="trip-time">{viaje.hora}</div>
          <div class="trip-details">
            <h3>{viaje.pasajero}</h3>
            <p>{viaje.destino}</p>
          </div>
          <div class="trip-status">
            {#if viaje.estado === 'confirmado'}
              ✅ Confirmado
            {:else}
              ⏳ Pendiente
            {/if}
          </div>
        </div>
      {/each}
    </div>

    <!-- Menú inferior -->
    <nav class="bottom-nav">
      <a href="#" class="nav-item active">🏠 Inicio</a>
      <a href="#" class="nav-item">📅 Agenda</a>
      <a href="#" class="nav-item">💬 Mensajes</a>
      <a href="#" class="nav-item">👤 Perfil</a>
    </nav>
  </div>
</div>

<style>
  /* ================ ESTILOS DASHBOARD CONDUCTOR ================ */
  .dashboard-container {
    background: rgba(255, 255, 255, 0.15);
    backdrop-filter: blur(12px);
    border-radius: 20px;
    padding: 1.5rem;
    max-width: 500px;
    margin: 1rem auto;
    box-shadow: 0 8px 32px rgba(31, 38, 135, 0.1);
  }

  .dashboard-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }

  .dashboard-header h1 {
    margin: 0;
    color: white;
    font-size: 1.8rem;
  }

  .status-badge {
    padding: 6px 12px;
    border-radius: 20px;
    font-size: 0.9rem;
    font-weight: 500;
  }

  .status-badge.available {
    background: rgba(40, 167, 69, 0.2);
    color: #28a745;
    border: 1px solid #28a745;
  }

  .status-badge.busy {
    background: rgba(220, 53, 69, 0.2);
    color: #dc3545;
    border: 1px solid #dc3545;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .stat-card {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 1rem;
    text-align: center;
    transition: transform 0.3s;
  }

  .stat-card:hover {
    transform: translateY(-5px);
    background: rgba(255, 255, 255, 0.15);
  }

  .stat-icon {
    font-size: 1.5rem;
    margin-bottom: 0.5rem;
  }

  .stat-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: white;
    margin-bottom: 0.2rem;
  }

  .stat-label {
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.7);
  }

  .control-panel {
    background: rgba(0, 0, 0, 0.1);
    border-radius: 15px;
    padding: 1rem;
    margin-bottom: 2rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .toggle-button {
    background: rgba(255, 255, 255, 0.1);
    border: none;
    color: white;
    padding: 12px;
    border-radius: 12px;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .toggle-button.active {
    background: rgba(40, 167, 69, 0.3);
    border: 1px solid #28a745;
  }

  .toggle-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .location {
    background: rgba(255, 255, 255, 0.05);
    padding: 10px 15px;
    border-radius: 10px;
    font-size: 0.9rem;
    color: rgba(255, 255, 255, 0.9);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .section-title {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .section-title h2 {
    margin: 0;
    color: white;
    font-size: 1.3rem;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .badge {
    background: rgba(255, 255, 255, 0.1);
    color: white;
    padding: 4px 8px;
    border-radius: 10px;
    font-size: 0.8rem;
  }

  .trips-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .trip-card {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 1rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    transition: all 0.3s;
  }

  .trip-card:hover {
    background: rgba(255, 255, 255, 0.15);
    transform: translateX(5px);
  }

  .trip-card.confirmado {
    border-left: 4px solid #28a745;
  }

  .trip-card.pendiente {
    border-left: 4px solid #ffc107;
  }

  .trip-time {
    font-size: 1.1rem;
    font-weight: 500;
    color: white;
    min-width: 60px;
  }

  .trip-details h3 {
    margin: 0 0 4px 0;
    color: white;
    font-size: 1rem;
  }

  .trip-details p {
    margin: 0;
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.9rem;
  }

  .trip-status {
    margin-left: auto;
    font-size: 0.8rem;
    padding: 4px 8px;
    border-radius: 10px;
  }

  .trip-card.confirmado .trip-status {
    background: rgba(40, 167, 69, 0.2);
    color: #28a745;
  }

  .trip-card.pendiente .trip-status {
    background: rgba(255, 193, 7, 0.2);
    color: #ffc107;
  }

  .bottom-nav {
    display: flex;
    justify-content: space-around;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 20px;
    padding: 0.8rem;
  }

  .nav-item {
    color: rgba(255, 255, 255, 0.6);
    text-decoration: none;
    font-size: 1.2rem;
    transition: all 0.3s;
    padding: 0.5rem;
    border-radius: 12px;
  }

  .nav-item.active {
    color: white;
    background: rgba(255, 255, 255, 0.15);
  }

  .nav-item:hover {
    transform: translateY(-3px);
  }

  /* Responsive */
  @media (max-width: 480px) {
    .dashboard-container {
      padding: 1rem;
      border-radius: 0;
    }
    
    .stats-grid {
      grid-template-columns: 1fr;
    }
  }
</style>