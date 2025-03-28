<script>
	import Lock from "../../../components/lock.svelte";
	import { supabase } from "../../../components/supabase";


  

    // Datos del pasajero
    let pasajero = {
      nombre: "Ana López",
      rating: 4.5,
      viajes: 32
    };
  
    // Viajes recientes
    let viajesRecientes = [
      { id: 1, conductor: "Carlos M.", fecha: "15/06/23", destino: "Aeropuerto", calificacion: 5 },
      { id: 2, conductor: "Juan P.", fecha: "10/06/23", destino: "Centro Comercial", calificacion: 4 },
      { id: 3, conductor: "María G.", fecha: "05/06/23", destino: "Casa", calificacion: 5 }
    ];
  
    // Conductores favoritos
    let favoritos = [
      { id: 1, nombre: "Carlos Mendoza", rating: 4.9, vehiculo: "Toyota Corolla" },
      { id: 2, nombre: "María García", rating: 4.8, vehiculo: "Nissan Versa" }
    ];

  </script>

  <Lock />


  
  <div class="wrapper">
    <div class="dashboard-container">
      <!-- Header -->
      <header class="dashboard-header">
        <h1>👋 Hola, {pasajero.nombre.split(" ")[0]}</h1>
        <div class="user-rating">
          ⭐ {pasajero.rating}
        </div>
      </header>
  
      <!-- Botón rápido -->
      <div class="quick-action">
        <button class="action-button primary">
          🚖 Pedir viaje ahora
        </button>
        <button class="action-button secondary">
          ⏱ Programar viaje
        </button>
      </div>
  
      <!-- Estadísticas -->
      <div class="section-title">
        <h2>📊 Tu actividad</h2>
      </div>
  
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">🚕</div>
          <div class="stat-value">{pasajero.viajes}</div>
          <div class="stat-label">Viajes</div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">⭐</div>
          <div class="stat-value">{pasajero.rating}</div>
          <div class="stat-label">Rating</div>
        </div>
      </div>
  
      <!-- Favoritos -->
      <div class="section-title">
        <h2>❤️ Tus conductores favoritos</h2>
        <span class="badge">{favoritos.length}</span>
      </div>
  
      <div class="favorites-list">
        {#each favoritos as conductor}
          <div class="favorite-card">
            <div class="driver-avatar">
              {conductor.nombre.charAt(0)}
            </div>
            <div class="driver-info">
              <h3>{conductor.nombre}</h3>
              <p>{conductor.vehiculo}</p>
              <div class="driver-rating">
                ⭐ {conductor.rating}
              </div>
            </div>
            <button class="call-button">
              📞 Llamar
            </button>
          </div>
        {/each}
      </div>
  
      <!-- Viajes recientes -->
      <div class="section-title">
        <h2>🕒 Viajes recientes</h2>
      </div>
  
      <div class="trips-list">
        {#each viajesRecientes as viaje}
          <div class="trip-card">
            <div class="trip-date">{viaje.fecha}</div>
            <div class="trip-details">
              <h3>{viaje.conductor}</h3>
              <p>{viaje.destino}</p>
            </div>
            <div class="trip-rating">
              {#each Array(5) as _, i}
                <span class="{i < viaje.calificacion ? 'active' : ''}">★</span>
              {/each}
            </div>
          </div>
        {/each}
      </div>
  
      <!-- Menú inferior -->
      <nav class="bottom-nav">
        <a href="#!" class="nav-item active">🏠 Inicio</a>
        <a href="#!" class="nav-item">🗺 Viajes</a>
        <a href="#!" class="nav-item">❤️ Favoritos</a>
        <a href="#!" class="nav-item">👤 Perfil</a>
      </nav>
    </div>
  </div>
  
  <style>
    /* ================ BASE ================ */
    .dashboard-container {
      background: rgba(255, 255, 255, 0.12);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border-radius: 24px;
      padding: 1.8rem;
      max-width: 500px;
      margin: 1.5rem auto;
      box-shadow: 
        0 12px 40px rgba(31, 38, 135, 0.15),
        0 6px 20px rgba(0, 0, 0, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.18);
    }
  
    /* ================ HEADER ================ */
    .dashboard-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
      padding-bottom: 1.5rem;
      border-bottom: 1px dashed rgba(255, 255, 255, 0.15);
    }
  
    .dashboard-header h1 {
      margin: 0;
      color: white;
      font-size: 1.9rem;
      font-weight: 600;
      letter-spacing: 0.5px;
    }
  
    .user-rating {
      background: linear-gradient(135deg, rgba(255, 193, 7, 0.25), transparent);
      color: #ffc107;
      padding: 8px 16px;
      border-radius: 24px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
      border: 1.5px solid rgba(255, 193, 7, 0.5);
    }
  
    /* ================ QUICK ACTIONS ================ */
    .quick-action {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.2rem;
      margin-bottom: 2.2rem;
    }
  
    .action-button {
      padding: 18px;
      border-radius: 16px;
      font-weight: 600;
      font-size: 1.05rem;
      border: none;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      border: 1px solid rgba(255, 255, 255, 0.15);
    }
  
    .primary {
      background: linear-gradient(135deg, rgba(13, 110, 253, 0.7), rgba(13, 110, 253, 0.4));
      color: white;
    }
  
    .secondary {
      background: linear-gradient(135deg, rgba(255, 255, 255, 0.12), transparent);
      color: white;
    }
  
    .action-button:hover {
      transform: translateY(-5px);
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
    }
  
    /* ================ STATS ================ */
    .stats-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.2rem;
      margin-bottom: 2.5rem;
    }
  
    /* (Reutilizar estilos de stat-card del dashboard conductor) */
  
    /* ================ FAVORITOS ================ */
    .favorites-list {
      display: flex;
      flex-direction: column;
      gap: 1.2rem;
      margin-bottom: 2.8rem;
    }
  
    .favorite-card {
      background: linear-gradient(135deg, rgba(255, 255, 255, 0.09), transparent);
      border-radius: 16px;
      padding: 1.4rem;
      display: flex;
      align-items: center;
      gap: 1.4rem;
      transition: all 0.3s ease;
      border: 1px solid rgba(255, 255, 255, 0.08);
    }
  
    .favorite-card:hover {
      background: rgba(255, 255, 255, 0.15);
      transform: translateX(8px);
      box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
    }
  
    .driver-avatar {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: linear-gradient(135deg, #6e8efb, #a777e3);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.8rem;
      font-weight: bold;
      color: white;
      flex-shrink: 0;
      border: 2px solid rgba(255, 255, 255, 0.3);
    }
  
    .driver-info {
      flex-grow: 1;
    }
  
    .driver-info h3 {
      margin: 0 0 6px 0;
      color: white;
      font-size: 1.1rem;
      font-weight: 500;
    }
  
    .driver-info p {
      margin: 0;
      color: rgba(255, 255, 255, 0.75);
      font-size: 0.95rem;
    }
  
    .driver-rating {
      margin-top: 6px;
      font-size: 0.9rem;
      color: #ffc107;
      display: flex;
      align-items: center;
      gap: 4px;
    }
  
    .call-button {
      background: linear-gradient(135deg, rgba(25, 135, 84, 0.7), transparent);
      color: white;
      border: none;
      padding: 10px 16px;
      border-radius: 12px;
      font-size: 0.95rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.3s;
      border: 1px solid rgba(255, 255, 255, 0.15);
    }
  
    .call-button:hover {
      background: rgba(25, 135, 84, 0.8);
      transform: translateY(-3px);
      box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
    }
  
    /* ================ HISTORIAL ================ */
    .trip-rating {
      display: flex;
      gap: 2px;
      color: rgba(255, 255, 255, 0.3);
      font-size: 1.1rem;
    }
  
    .trip-rating .active {
      color: #ffc107;
    }
  
    /* (Reutilizar estilos de bottom-nav del dashboard conductor) */
  
    /* ================ RESPONSIVE ================ */
    @media (max-width: 600px) {
      .quick-action {
        grid-template-columns: 1fr;
      }
  
      .favorite-card {
        flex-direction: column;
        text-align: center;
      }
  
      .driver-info {
        text-align: center;
      }
  
      .call-button {
        width: 100%;
      }
    }
  </style>