<script lang="ts">
  import { onMount, onDestroy, afterUpdate } from 'svelte';
  import { writable } from 'svelte/store';
  import { supabase } from '../../../components/supabase';
  import { browser } from '$app/environment';
  import { DateTime } from 'luxon';
	
  
	
  

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
	<!-- Barra superior con botones -->
	<div class="control-bar">
		<a href="/auth/dashboard-conductor/maps" class="control-btn map-btn">
			<i class="fas fa-map-marked-alt"></i> Mapa
		</a>
		<a href="/pasajeros" class="control-btn passengers-btn">
			<i class="fas fa-users"></i> Pasajeros
		</a>
	</div>

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
  .taxi-dashboard {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  background-color: #f5f5f5;
  border-radius: 10px;
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
}

.control-bar {
  display: flex;
  justify-content: space-between;
  margin-bottom: 20px;
}

.control-btn {
  padding: 10px 15px;
  border: none;
  border-radius: 5px;
  font-weight: bold;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.3s ease;
  text-decoration: none;
}

.map-btn {
  background-color: #3498db;
  color: white;
}

.map-btn:hover {
  background-color: #2980b9;
}

.passengers-btn {
  background-color: #2ecc71;
  color: white;
}

.passengers-btn:hover {
  background-color: #27ae60;
}

.lock-btn {
  background-color: #e74c3c;
  color: white;
}

.lock-btn:hover {
  background-color: #c0392b;
}

.main-content {
  background-color: white;
  border-radius: 10px;
  padding: 25px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
}

.status-card {
  text-align: center;
  margin-bottom: 30px;
}

.title {
  color: #2c3e50;
  margin-bottom: 25px;
  font-size: 24px;
}

.status-display {
  padding: 25px;
  border-radius: 10px;
  margin: 20px auto;
  max-width: 300px;
  transition: all 0.3s ease;
}

.status-icon {
  font-size: 50px;
  margin-bottom: 15px;
}

.status-text {
  font-size: 20px;
  font-weight: bold;
}

.sin_servicio {
  background-color: #f1c40f;
  color: #7d6608;
}

.en_servicio {
  background-color: #2ecc71;
  color: #0e5737;
}

.en_viaje_ureña, .en_viaje_colón {
  background-color: #3498db;
  color: #1a5276;
}

.viaje_finalizado {
  background-color: #9b59b6;
  color: #4a235a;
}

.timer-container {
  margin-top: 20px;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.timer-container.visible {
  opacity: 1;
}

.timer {
  background-color: #34495e;
  color: white;
  padding: 10px 15px;
  border-radius: 5px;
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.action-buttons {
  display: flex;
  justify-content: center;
  margin-top: 20px;
}

.action-btn {
  padding: 12px 25px;
  border: none;
  border-radius: 5px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 10px;
  transition: all 0.3s ease;
  margin: 0 10px;
}

.start-btn {
  background-color: #2ecc71;
  color: white;
}

.start-btn:hover {
  background-color: #27ae60;
}

.trip-buttons {
  display: flex;
  gap: 15px;
}

.trip-btn {
  background-color: #3498db;
  color: white;
}

.trip-btn:hover {
  background-color: #2980b9;
}

.end-btn {
  background-color: #e74c3c;
  color: white;
}

.end-btn:hover {
  background-color: #c0392b;
}

.restart-btn {
  background-color: #9b59b6;
  color: white;
}

.restart-btn:hover {
  background-color: #8e44ad;
}

.wait-btn {
  background-color: #f39c12;
  color: white;
  margin-bottom: 15px;
}

.wait-btn:hover {
  background-color: #d35400;
}

.fuel-btn {
  background-color: #e67e22;
  color: white;
  margin-bottom: 15px;
}

.fuel-btn:hover {
  background-color: #d35400;
}

.return-btn {
  background-color: #16a085;
  color: white;
  margin-bottom: 15px;
}

.return-btn:hover {
  background-color: #1abc9c;
}

.error-message {
  color: #e74c3c;
  background-color: #fadbd8;
  padding: 10px;
  border-radius: 5px;
  margin: 15px 0;
  font-weight: bold;
}

@media (max-width: 600px) {
  .control-bar {
    flex-direction: column;
    gap: 10px;
  }
  
  .trip-buttons {
    flex-direction: column;
  }
  
  .action-btn {
    width: 100%;
    justify-content: center;
    margin: 5px 0;
  }
}
</style>
