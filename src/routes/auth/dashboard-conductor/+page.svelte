<script lang="ts">
  import { supabase } from "../../../components/supabase";
  import { onMount } from 'svelte';
  import { writable } from 'svelte/store';
	import Lock from "../../../components/lock.svelte";
  

  // Tipos
  type Conductor = {
    id: number;
    created_at?: string;
    nombre: string;
    placa: string;
    email: string;
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
  const estadoActual = writable<string>("Descanso");
  const error = writable<string>("");
  const isLoading = writable<boolean>(false);
  const session = writable<any>(null);

  // Variables reactivas
  let conductorData: Conductor | null = null;
  let currentEstado: string = "Descanso";
  let errorMessage: string = "";
  let loading: boolean = false;
  let currentSession: any = null;

  // Suscripciones
  conductor.subscribe(value => conductorData = value);
  estadoActual.subscribe(value => currentEstado = value);
  error.subscribe(value => errorMessage = value);
  isLoading.subscribe(value => loading = value);
  session.subscribe(value => currentSession = value);

  // Obtener sesión activa
  const getSession = async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error("Error obteniendo sesión:", error);
      return null;
    }
    session.set(data.session);
    return data.session;
  };

  // Obtener conductor basado en el email del usuario autenticado
  const obtenerConductor = async () => {
    isLoading.set(true);
    try {
      const session = await getSession();
      if (!session?.user?.email) {
        throw new Error("No hay usuario autenticado");
      }

      const { data, error: sbError } = await supabase
        .from('conductor')
        .select('*')
        .eq('email', session.user.email)
        .single();

      if (sbError) throw sbError;
      if (!data) throw new Error("Conductor no encontrado");

      conductor.set(data);
      await obtenerUltimoEstado(data.id);
    } catch (err) {
      error.set(err instanceof Error ? err.message : String(err));
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
        .order('created_at', { ascending: false })
        .limit(1);

      if (sbError) throw sbError;
      if (data?.[0]?.estado) {
        estadoActual.set(data[0].estado);
      }
    } catch (err) {
      error.set("Error obteniendo estado actual");
      console.error(err);
    }
  };

  // Cambiar estado (se mantiene igual)
  const cambiarEstado = async (nuevoEstado: string, descripcion: string = "") => {
    if (!conductorData) {
      error.set("No hay datos del conductor");
      return;
    }

    isLoading.set(true);
    try {
      const { error: sbError } = await supabase
        .from('estado_conductor')
        .insert({
          conductor_id: conductorData.id,
          estado: nuevoEstado,
          descripcion: descripcion || null
        });

      if (sbError) throw sbError;

      estadoActual.set(nuevoEstado);
      error.set(`Estado actualizado: ${nuevoEstado}`);
      setTimeout(() => error.set(""), 3000);
    } catch (err) {
      error.set("Error cambiando estado");
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
        estadoActual.set("Descanso");
      }
    });
  });
</script>

<Lock />

<div class="dashboard">
  {#if loading}
    <div class="loading-indicator">Cargando...</div>
  {:else if conductorData}
    <div class="header">
      <h1>Bienvenido, {conductorData.nombre}</h1>
      <p>Placa: {conductorData.placa}</p>
      <p>Email: {conductorData.email}</p>
      {#if conductorData.telefono}
        <p>Teléfono: {conductorData.telefono}</p>
      {/if}
    </div>

    <div class="current-state">
      <h2>Estado Actual: {currentEstado}</h2>
    </div>

    <div class="actions">
      <button on:click={() => cambiarEstado('En servicio')} class="btn service">
        En Servicio
      </button>
      <button on:click={() => cambiarEstado('Descanso')} class="btn rest">
        Descanso
      </button>
      <button 
        on:click={() => cambiarEstado('En ruta', 'Ruta: Colón → Ureña')} 
        class="btn route">
        Colón → Ureña
      </button>
      <button 
        on:click={() => cambiarEstado('En ruta', 'Ruta: Ureña → Colón')} 
        class="btn route">
        Ureña → Colón
      </button>
      <button on:click={() => cambiarEstado('Accidentado')} class="btn accident">
        Accidentado
      </button>
    </div>
  {:else}
    <div class="no-driver">
      No se encontraron datos del conductor
    </div>
  {/if}

  {#if errorMessage}
    <div class="notification {errorMessage.includes('actualizado') ? 'success' : 'error'}">
      {errorMessage}
    </div>
  {/if}
</div>

<style>
  .dashboard {
    max-width: 600px;
    margin: 0 auto;
    padding: 20px;
    font-family: 'Arial', sans-serif;
  }

  .header {
    text-align: center;
    margin-bottom: 30px;
    padding: 20px;
    background: #f5f5f5;
    border-radius: 8px;
  }

  .current-state {
    text-align: center;
    margin: 20px 0;
    padding: 15px;
    background: #e3f2fd;
    border-radius: 8px;
    font-size: 1.2em;
  }

  .actions {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 15px;
    margin-top: 30px;
  }

  .btn {
    padding: 12px;
    border: none;
    border-radius: 6px;
    color: white;
    font-weight: bold;
    cursor: pointer;
    transition: transform 0.2s, opacity 0.2s;
  }

  .btn:hover {
    opacity: 0.9;
    transform: translateY(-2px);
  }

  .service { background-color: #4CAF50; }
  .rest { background-color: #FFC107; color: #333; }
  .route { background-color: #2196F3; }
  .accident { background-color: #F44336; }

  .notification {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    padding: 12px 24px;
    border-radius: 4px;
    color: white;
    font-weight: bold;
  }

  .error { background-color: #F44336; }
  .success { background-color: #4CAF50; }

  .loading-indicator {
    text-align: center;
    padding: 20px;
    color: #666;
  }

  .no-driver {
    text-align: center;
    padding: 20px;
    color: #F44336;
    font-weight: bold;
  }
</style>
