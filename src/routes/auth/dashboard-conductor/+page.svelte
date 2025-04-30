<script lang="ts">
  import { onMount, onDestroy, afterUpdate } from 'svelte';
  import { writable } from 'svelte/store';
  import { supabase } from '../../../components/supabase';
  import { browser } from '$app/environment';
  import { DateTime } from 'luxon';
	import Navbar from '../../../components/navbar.svelte';
  
  type EstadoViaje =
    | 'sin_servicio'
    | 'en_servicio'
    | 'en_viaje_ureña'
    | 'en_viaje_colón'
    | 'viaje_finalizado'
    | 'en_parrilla'
    | 'surtiendo_combustible'
    | 'llegando_de_surtir';

  const estadoActual = writable<EstadoViaje>(
    browser ? (localStorage.getItem('taxiEstado') as EstadoViaje) || 'sin_servicio' : 'sin_servicio'
  );

  const tiempoTranscurrido = writable<string>('0h 0m 0s');
  const error = writable<string>('');
  const isLoading = writable<boolean>(false);

  let intervalo: NodeJS.Timeout | null = null;
  let inicioTimestamp: number | null = browser
      ? Number(localStorage.getItem('cronometro')) || null
      : null;
  let conductor_id: number | null = null;
  let destinoActual: 'ureña' | 'colón' | null = null;

  const obtenerConductorId = async () => {
      try {
          const { data: sessionData } = await supabase.auth.getSession();
          if (!sessionData.session?.user?.email) throw new Error('No hay sesión activa.');

          const { data, error: sbError } = await supabase
              .from('conductor')
              .select('id')
              .eq('email', sessionData.session.user.email)
              .single();

          if (sbError || !data) throw new Error('Conductor no encontrado en la base de datos.');

          conductor_id = data.id;
          console.log('✅ Conductor ID obtenido:', conductor_id);
      } catch (err) {
          error.set(`🚨 Error: ${err instanceof Error ? err.message : 'Problema desconocido'}`);
      }
  };

  const actualizarCronometro = () => {
    if (inicioTimestamp) {
        const segundosTotales = Math.floor((Date.now() - inicioTimestamp) / 1000);
        const horas = Math.floor(segundosTotales / 3600);
        const minutos = Math.floor((segundosTotales % 3600) / 60);
        const segundos = segundosTotales % 60;
        tiempoTranscurrido.set(`${horas}h ${minutos}m ${segundos}s`);
    }
  };

  const iniciarServicio = () => {
      estadoActual.set('en_servicio');
      destinoActual = null;
  };

  onMount(async () => {
      await obtenerConductorId();

      if (inicioTimestamp) {
          intervalo = setInterval(actualizarCronometro, 1000);
          actualizarCronometro();
      }
  });

  afterUpdate(() => {
      if (browser) localStorage.setItem('taxiEstado', $estadoActual);
  });

  const actualizarEstado = async (nuevoEstado: EstadoViaje) => {
      if (!conductor_id) {
          error.set('🚨 No se pudo obtener conductor_id.');
          return;
      }

      const estadosBloqueados: EstadoViaje[] = ['en_viaje_ureña', 'en_viaje_colón'];
      if (estadosBloqueados.includes($estadoActual) && 
          (nuevoEstado === 'en_parrilla' || nuevoEstado === 'surtiendo_combustible' || nuevoEstado === 'llegando_de_surtir')) {
          error.set(`🚨 No puedes cambiar a ${nuevoEstado} mientras estás en viaje.`);
          return;
      }

      const timestampCaracas = DateTime.now().setZone('America/Caracas').toISO();

      try {
          console.log(`🛠 Intentando actualizar estado: ${nuevoEstado} - Hora: ${timestampCaracas}`);

          const { error: insertError } = await supabase.from('viajes').insert({
              conductor_id,
              estado: nuevoEstado,
              hora_inicio: timestampCaracas
          });

          if (insertError) {
              console.error('🚨 Error en Supabase:', insertError);
              throw insertError;
          }

          console.log(`✅ Estado actualizado a: ${nuevoEstado}`);
          estadoActual.set(nuevoEstado);
      } catch (err) {
          error.set(`🚨 Error al actualizar estado: ${err instanceof Error ? err.message : 'Error desconocido'}`);
      }
  };

  const iniciarViaje = (destino: 'ureña' | 'colón') => {
      if (!destino) {
          error.set('🚨 No se recibió un destino válido.');
          return;
      }

      if ($estadoActual === 'surtiendo_combustible') {
          error.set('🚨 No puedes iniciar un viaje mientras estás surtiendo combustible.');
          return;
      }

      inicioTimestamp = Date.now();
      destinoActual = destino;

      console.log('✅ Viaje iniciado hacia:', destinoActual);

      if (browser) localStorage.setItem('cronometro', String(inicioTimestamp));

      intervalo = setInterval(actualizarCronometro, 1000);
      estadoActual.set(destino === 'ureña' ? 'en_viaje_ureña' : 'en_viaje_colón');
  };

  const finalizarViaje = async () => {
      if (!conductor_id || !destinoActual) {
          error.set('🚨 No se puede finalizar el viaje.');
          return;
      }

      console.log('✅ Finalizando viaje hacia:', destinoActual);

      if (intervalo) clearInterval(intervalo);

      const tiempoTotal = Math.floor((Date.now() - inicioTimestamp!) / 1000);
      if (browser) localStorage.removeItem('cronometro');

      tiempoTranscurrido.set('0h 0m 0s');
      estadoActual.set('viaje_finalizado');

      const horaInicioCaracas = DateTime.fromMillis(inicioTimestamp!, { zone: 'America/Caracas' }).toISO();
      const horaFinCaracas = DateTime.now().setZone('America/Caracas').toISO();

      try {
          const { error: insertError } = await supabase.from('viajes').insert({
              conductor_id,
              destino: destinoActual,
              estado: 'finalizado',
              hora_inicio: horaInicioCaracas,
              hora_fin: horaFinCaracas,
              duracion_total: tiempoTotal
          });

          if (insertError) throw insertError;
          console.log('✅ Viaje registrado correctamente en Supabase.');
      } catch (err) {
          error.set(`🚨 Error al registrar/actualizar el viaje: ${err instanceof Error ? err.message : 'Error desconocido'}`);
      }
  };

  const enParrilla = () => actualizarEstado('en_parrilla');
  const surtiendoCombustible = () => actualizarEstado('surtiendo_combustible');
  const llegandoDeSurtir = () => actualizarEstado('llegando_de_surtir');

  onDestroy(() => {
      if (intervalo) clearInterval(intervalo);
  });
</script>

<div class="taxi-dashboard">

	<!-- Contenido centrado -->
	<div class="main-content">
    <div class="status-card">
        <h1 class="title">🚕 Estado del Servicio de Taxi</h1>

        <!-- Botones de estados previos al viaje -->
        <button on:click={enParrilla} class="action-btn wait-btn">
            <i class="fas fa-list"></i> 🚖 En Parrilla
        </button>
        <button on:click={surtiendoCombustible} class="action-btn fuel-btn">
            <i class="fas fa-gas-pump"></i> ⛽ Surtiendo Combustible
        </button>
        <button on:click={llegandoDeSurtir} class="action-btn return-btn">
            <i class="fas fa-arrow-circle-left"></i> 🔙 Llegando de Surtir
        </button>

        {#if $error}
            <div class="error-message">{$error}</div>
        {/if}

        <div class="status-display {$estadoActual}">
            <div class="status-icon">
                {#if $estadoActual === 'sin_servicio'}
                    <i class="fas fa-pause-circle"></i>
                {:else if $estadoActual === 'en_servicio'}
                    <i class="fas fa-sync-alt"></i>
                {:else if $estadoActual === 'en_viaje_ureña' || $estadoActual === 'en_viaje_colón'}
                    <i class="fas fa-car-side"></i>
                {:else if $estadoActual === 'viaje_finalizado'}
                    <i class="fas fa-check-circle"></i>
                {/if}
            </div>

            <div class="status-text">
                {#if $estadoActual === 'sin_servicio'}
                    <p>Servicio inactivo</p>
                {:else if $estadoActual === 'en_servicio'}
                    <p>En espera de viaje</p>
                {:else if $estadoActual === 'en_viaje_ureña'}
                    <p>En viaje a Ureña</p>
                {:else if $estadoActual === 'en_viaje_colón'}
                    <p>En viaje a Colón</p>
                {:else if $estadoActual === 'viaje_finalizado'}
                    <p>Viaje completado</p>
                {/if}
            </div>
        </div>

        <div class="timer-container" class:visible={$estadoActual.startsWith('en_viaje')}>
            <div class="timer">
                <i class="fas fa-stopwatch"></i> Tiempo: {$tiempoTranscurrido}
            </div>
        </div>
    </div>

    <div class="action-buttons">
      {#if $estadoActual === 'sin_servicio'}
          <button on:click={iniciarServicio} class="action-btn start-btn">
              <i class="fas fa-play"></i> Iniciar Servicio
          </button>
      {:else if $estadoActual === 'en_servicio' || $estadoActual === 'llegando_de_surtir' || $estadoActual === 'en_parrilla'}
      <div class="trip-buttons">
        <button 
          on:click={() => iniciarViaje('ureña')} 
          class="action-btn trip-btn" 
          disabled={!['en_servicio', 'en_parrilla', 'llegando_de_surtir'].includes($estadoActual)}>
          <i class="fas fa-road"></i> Viaje a Ureña
        </button>
        <button 
          on:click={() => iniciarViaje('colón')} 
          class="action-btn trip-btn" 
          disabled={!['en_servicio', 'en_parrilla', 'llegando_de_surtir'].includes($estadoActual)}>
          <i class="fas fa-road"></i> Viaje a Colón
        </button>
      </div>
      {:else if $estadoActual === 'surtiendo_combustible'}
          <!-- No se muestra la opción de viaje mientras se surte combustible -->
      {:else if $estadoActual.startsWith('en_viaje')}
          <button on:click={finalizarViaje} class="action-btn end-btn">
              <i class="fas fa-flag-checkered"></i> Finalizar Viaje
          </button>
      {:else if $estadoActual === 'viaje_finalizado'}
          <button on:click={iniciarServicio} class="action-btn restart-btn">
              <i class="fas fa-redo"></i> Nuevo Servicio
          </button>
      {/if}
    </div>
  </div>
</div>

<style>
  /* Estilos generales */
.taxi-dashboard {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 50vh;
    font-family: 'Poppins', sans-serif;
}

/* Tarjeta de estado */
.status-card {
    background: #fff;
    padding: 2rem;
    border-radius: 12px;
    box-shadow: 0px 8px 20px rgba(0, 0, 0, 0.2);
    text-align: center;
    max-width: 400px;
}

/* Título */
.title {
    font-size: 1.8rem;
    font-weight: bold;
    color: #222;
}

/* Botones */
.action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    padding: 12px;
    margin: 8px 0;
    font-size: 1rem;
    font-weight: bold;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.action-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.1);
}

/* Colores de estados */
.wait-btn { background: #FFC107; color: #222; }
.fuel-btn { background: #007BFF; color: #fff; }
.return-btn { background: #28A745; color: #fff; }
.trip-btn { background: #FF5722; color: #fff; }
.end-btn { background: #E91E63; color: #fff; }
.restart-btn { background: #6C757D; color: #fff; }

/* Contenedor de estado */
.status-display {
    margin-top: 16px;
    padding: 20px;
    border-radius: 10px;
    color: #fff;
    font-weight: bold;
}

.status-icon i {
    font-size: 2.5rem;
}

/* Temporizador */
.timer-container {
    margin-top: 12px;
    font-size: 1.2rem;
    font-weight: bold;
    color: #333;
}

</style>
