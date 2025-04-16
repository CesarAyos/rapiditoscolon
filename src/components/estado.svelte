<script lang="ts">
    import { onMount } from 'svelte';
    import { supabase } from '../components/supabase';
    import { writable } from 'svelte/store';
  
    type Conductor = {
      id: number;
      nombre: string;
      placa: string;
      email: string;
      control: string;
      propiedad: string;
      telefono?: string | null;
      estado?:
        | 'en_servicio_colon'
        | 'en_servicio_ureña'
        | 'en_ruta_colon_ureña'
        | 'en_ruta_ureña_colon'
        | 'accidentado'
        | 'descanso';
    };
  
    type DriverStatus = {
      en_servicio_colon: Conductor[];
      en_servicio_ureña: Conductor[];
      en_ruta_colon_ureña: Conductor[];
      en_ruta_ureña_colon: Conductor[];
      accidentado: Conductor[];
      descanso: Conductor[];
    };
  
    // Stores
    export const driverStatusStore = writable<DriverStatus>({
      en_servicio_colon: [],
      en_servicio_ureña: [],
      en_ruta_colon_ureña: [],
      en_ruta_ureña_colon: [],
      accidentado: [],
      descanso: []
    });
    export const loadingStatus = writable<boolean>(false);
  
    // Cargar estado de todos los conductores
    export const loadDriverStatus = async () => {
      loadingStatus.set(true);
      try {
        const { data: ultimosEstados, error: estadosError } = await supabase
          .from('estado_conductor')
          .select(
            `
            conductor_id,
            estado,
            conductor:conductor!estado_conductor_conductor_id_fkey(
              id, nombre, placa, email, control, propiedad, telefono
            )
          `
          )
          .order('created_at', { ascending: false });
  
        if (estadosError) throw estadosError;
        if (!ultimosEstados) throw new Error('No se encontraron estados');
  
        const conductoresPorId = ultimosEstados.reduce((acc, current) => {
          if (!acc.has(current.conductor_id)) {
            acc.set(current.conductor_id, {
              ...current.conductor,
              estado: current.estado
            });
          }
          return acc;
        }, new Map<number, any>());
  
        const conductores = Array.from(conductoresPorId.values());
  
        const statusData: DriverStatus = {
          en_servicio_colon: [],
          en_servicio_ureña: [],
          en_ruta_colon_ureña: [],
          en_ruta_ureña_colon: [],
          accidentado: [],
          descanso: []
        };
  
        conductores.forEach((conductor) => {
          const estado = conductor.estado || 'descanso';
  
          switch (estado) {
            case 'en_servicio_colon':
              statusData.en_servicio_colon.push(conductor);
              break;
            case 'en_servicio_ureña':
              statusData.en_servicio_ureña.push(conductor);
              break;
            case 'en_ruta_colon_ureña':
              statusData.en_ruta_colon_ureña.push(conductor);
              break;
            case 'en_ruta_ureña_colon':
              statusData.en_ruta_ureña_colon.push(conductor);
              break;
            case 'accidentado':
              statusData.accidentado.push(conductor);
              break;
            default:
              statusData.descanso.push(conductor);
          }
        });
  
        driverStatusStore.set(statusData);
     
      } finally {
        loadingStatus.set(false);
      }
    };
  
    // Configurar suscripción a cambios en tiempo real
    let realtimeSubscription: any = null;
  
    onMount(() => {
    // Función para manejar la inicialización async
    const initialize = async () => {
      await loadDriverStatus();
      
      realtimeSubscription = supabase
        .channel('driver_status_updates')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'estado_conductor'
          },
          async () => {
            await loadDriverStatus();
          }
        )
        .subscribe();
    };

    initialize();

    // Función de cleanup síncrona
    return () => {
      if (realtimeSubscription) {
        supabase.removeChannel(realtimeSubscription);
      }
    };
  });
  </script>
  
  <div class="status-section">
    <div class="status-header">
      <h2>Estado de Conductores</h2>
      <button on:click={loadDriverStatus} class="refresh-btn">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
          <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
          <path d="M16 16h5v5" />
        </svg>
        Actualizar
      </button>
    </div>
  
    {#if $loadingStatus}
      <div class="loading-spinner">
        <div class="spinner"></div>
      </div>
    {:else}
      <div class="status-grid">
        <div class="status-card">
          <h3>En servicio Colón</h3>
          {#each $driverStatusStore.en_servicio_colon as driver}
            <div class="driver-status-item">
              <span class="driver-name">{driver.nombre}</span>
              <span class="driver-placa">{driver.placa}</span>
              <span class="driver-placa">control:{driver.control}</span>
            </div>
          {:else}
            <p class="no-drivers">No hay conductores en esta ruta</p>
          {/each}
        </div>
  
        <div class="status-card">
          <h3>En servicio Ureña</h3>
          {#each $driverStatusStore.en_servicio_ureña as driver}
            <div class="driver-status-item">
              <span class="driver-name">{driver.nombre}</span>
              <span class="driver-placa">{driver.placa}</span>
              <span class="driver-placa">control:{driver.control}</span>
            </div>
          {:else}
            <p class="no-drivers">No hay conductores en esta ruta</p>
          {/each}
        </div>
  
        <div class="status-card">
          <h3>Ruta Colón - Ureña</h3>
          {#each $driverStatusStore.en_ruta_colon_ureña as driver}
            <div class="driver-status-item">
              <span class="driver-name">{driver.nombre}</span>
              <span class="driver-placa">{driver.placa}</span>
              <span class="driver-placa">control:{driver.control}</span>
            </div>
          {:else}
            <p class="no-drivers">No hay conductores en esta ruta</p>
          {/each}
        </div>
  
        <div class="status-card">
          <h3>Ruta Ureña - Colón</h3>
          {#each $driverStatusStore.en_ruta_ureña_colon as driver}
            <div class="driver-status-item">
              <span class="driver-name">{driver.nombre}</span>
              <span class="driver-placa">{driver.placa}</span>
              <span class="driver-placa">control:{driver.control}</span>
            </div>
          {:else}
            <p class="no-drivers">No hay conductores en esta ruta</p>
          {/each}
        </div>
  
        <div class="status-card">
          <h3>Accidentados</h3>
          {#each $driverStatusStore.accidentado as driver}
            <div class="driver-status-item">
              <span class="driver-name">{driver.nombre}</span>
              <span class="driver-placa">{driver.placa}</span>
              <span class="driver-placa">control:{driver.control}</span>
            </div>
          {:else}
            <p class="no-drivers">No hay conductores accidentados</p>
          {/each}
        </div>
  
        <div class="status-card">
          <h3>En Descanso</h3>
          {#each $driverStatusStore.descanso as driver}
            <div class="driver-status-item">
              <span class="driver-name">{driver.nombre}</span>
              <span class="driver-placa">{driver.placa}</span>
              <span class="driver-placa">control:{driver.control}</span>
            </div>
          {:else}
            <p class="no-drivers">No hay conductores en descanso</p>
          {/each}
        </div>
      </div>
    {/if}
  </div>
  
  <style>
    .status-section {
      margin-top: 2rem;
      background: white;
      border-radius: 10px;
      padding: 1.5rem;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
    }
  
    .status-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
    }
  
    .status-header h2 {
      margin: 0;
      font-size: 1.4rem;
      color: #2c3e50;
    }
  
    .refresh-btn {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      background-color: #3498db;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s;
      font-size: 0.9rem;
    }
  
    .refresh-btn:hover {
      background-color: #2980b9;
      transform: translateY(-1px);
    }
  
    @keyframes spin {
      from {
        transform: rotate(0deg);
      }
      to {
        transform: rotate(360deg);
      }
    }
  
    .status-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 1.5rem;
    }
  
    .status-card {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 1rem;
      border-left: 4px solid #3498db;
    }
  
    .status-card h3 {
      margin: 0 0 1rem 0;
      font-size: 1.1rem;
      color: #2c3e50;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid #e0e6ed;
    }
  
    .driver-status-item {
      display: flex;
      justify-content: space-between;
      padding: 0.5rem 0;
      font-size: 0.9rem;
    }
  
    .driver-status-item:not(:last-child) {
      border-bottom: 1px dashed #e0e6ed;
    }
  
    .no-drivers {
      color: #718096;
      font-size: 0.9rem;
      font-style: italic;
      margin: 0.5rem 0;
    }
  
    .loading-spinner {
      display: flex;
      justify-content: center;
      padding: 2rem;
    }
  
    .spinner {
      width: 2rem;
      height: 2rem;
      border: 3px solid rgba(0, 0, 0, 0.1);
      border-radius: 50%;
      border-top-color: #3498db;
      animation: spin 1s ease-in-out infinite;
    }
  
    /* Responsive adjustments */
    @media (max-width: 768px) {
      .status-grid {
        grid-template-columns: 1fr 1fr;
      }
    }
  
    @media (max-width: 480px) {
      .status-grid {
        grid-template-columns: 1fr;
      }
  
      .status-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 1rem;
      }
  
      .refresh-btn {
        width: 100%;
        justify-content: center;
      }
    }
  </style>