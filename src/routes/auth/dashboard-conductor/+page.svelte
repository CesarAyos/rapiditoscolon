<script lang="ts">
    import { onMount, onDestroy, afterUpdate } from 'svelte';
    import { writable } from 'svelte/store';
    import { supabase } from '../../../components/supabase';
    import { browser } from '$app/environment';
    import Lock from '../../../components/lock.svelte';
    import  { DateTime } from 'luxon';


    type EstadoViaje =
        | 'sin_servicio'
        | 'en_servicio'
        | 'en_viaje_ureña'
        | 'en_viaje_colón'
        | 'viaje_finalizado';

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

    const iniciarServicio = () => {
        estadoActual.set('en_servicio');
        destinoActual = null;
    };

    const iniciarViaje = (destino: 'ureña' | 'colón') => {
        if (!destino) {
            error.set('🚨 No se recibió un destino válido.');
            return;
        }

        inicioTimestamp = Date.now();
        destinoActual = destino;

        console.log('✅ Viaje iniciado hacia:', destinoActual);

        if (browser) localStorage.setItem('cronometro', String(inicioTimestamp));

        intervalo = setInterval(actualizarCronometro, 1000);
        estadoActual.set(destino === 'ureña' ? 'en_viaje_ureña' : 'en_viaje_colón');
    };

    const actualizarCronometro = () => {
        if (inicioTimestamp) {
            const segundosTotales = Math.floor((Date.now() - inicioTimestamp!) / 1000);
            const horas = Math.floor(segundosTotales / 3600);
            const minutos = Math.floor((segundosTotales % 3600) / 60);
            const segundos = segundosTotales % 60;
            tiempoTranscurrido.set(`${horas}h ${minutos}m ${segundos}s`);
        }
    };

    const finalizarViaje = async () => {
        if (!conductor_id) {
            error.set('🚨 No se pudo obtener conductor_id.');
            return;
        }

        if (!destinoActual) {
            error.set('🚨 No se puede finalizar el viaje porque `destinoActual` es undefined.');
            console.error('🚨 Error: destinoActual no está definido.');
            return;
        }

        console.log('✅ Finalizando viaje hacia:', destinoActual);

        if (intervalo) clearInterval(intervalo);

        const tiempoTotal = Math.floor((Date.now() - inicioTimestamp!) / 1000);
        if (browser) localStorage.removeItem('cronometro');

        tiempoTranscurrido.set('0h 0m 0s');
        estadoActual.set('viaje_finalizado');

        // 🔹 Obtener la hora de inicio y fin en Caracas
        const horaInicioCaracas = DateTime.fromMillis(inicioTimestamp!, { zone: 'America/Caracas' }).toISO();
        const horaFinCaracas = DateTime.now().setZone('America/Caracas').toISO();

        try {
            // 🔍 Verificar si ya existe un viaje activo para el conductor
            const { data: viajeExistente, error: consultaError } = await supabase
                .from('viajes')
                .select('id')
                .eq('conductor_id', conductor_id)
                .neq('estado', 'finalizado')
                .maybeSingle();

            if (consultaError) throw consultaError;

            if (viajeExistente) {
                // 🔄 Actualizar el viaje existente
                const { error: updateError } = await supabase
                    .from('viajes')
                    .update({
                        estado: 'finalizado',
                        hora_fin: horaFinCaracas,
                        duracion_total: tiempoTotal
                    })
                    .eq('id', viajeExistente.id);

                if (updateError) throw updateError;
                console.log('✅ Viaje actualizado correctamente.');
            } else {
                // 🆕 Insertar un nuevo viaje si no existe uno activo
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
            }
        } catch (err) {
            error.set('🚨 Error al registrar/actualizar el viaje.');
        }
    };

    onDestroy(() => intervalo && clearInterval(intervalo));
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
	  <button class="control-btn lock-btn">
		<Lock />
	  </button>
	</div>
  
	<!-- Contenido centrado -->
	<div class="main-content">
	  <div class="status-card">
		<h1 class="title">🚕 Estado del Servicio de Taxi</h1>
  
		{#if $error}
		  <div class="error-message">{$error}</div>
		{/if}
  
		<div class="status-display {$estadoActual}">
		  <div class="status-icon">
			{#if $estadoActual === 'sin_servicio'}
			  <i class="fas fa-pause-circle"></i>
			{:else if $estadoActual === 'en_servicio'}
			  <i class="fas fa-sync-alt"></i>
			{:else if $estadoActual === 'en_viaje_ureña'}
			  <i class="fas fa-car-side"></i>
			{:else if $estadoActual === 'en_viaje_colón'}
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
			<i class="fas fa-stopwatch"></i> Tiempo: {$tiempoTranscurrido} segundos
		  </div>
		</div>
	  </div>
  
	  <div class="action-buttons">
		{#if $estadoActual === 'sin_servicio'}
		  <button on:click={iniciarServicio} class="action-btn start-btn">
			<i class="fas fa-play"></i> Iniciar Servicio
		  </button>
		{:else if $estadoActual === 'en_servicio'}
		  <div class="trip-buttons">
			<button on:click={() => iniciarViaje('ureña')} class="action-btn trip-btn">
			  <i class="fas fa-road"></i> Viaje a Ureña
			</button>
			<button on:click={() => iniciarViaje('colón')} class="action-btn trip-btn">
			  <i class="fas fa-road"></i> Viaje a Colón
			</button>
		  </div>
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
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background-color: #f8f9fa;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

/* Barra superior */
.control-bar {
  display: flex;
  justify-content: flex-end;
  padding: 15px 25px;
  background-color: #2c3e50;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.control-btn {
  padding: 10px 15px;
  margin-left: 10px;
  border: none;
  border-radius: 6px;
  color: white;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
}

.map-btn {
  background-color: #3498db;
}

.map-btn:hover {
  background-color: #2980b9;
}

.passengers-btn {
  background-color: #9b59b6;
}

.passengers-btn:hover {
  background-color: #8e44ad;
}

.lock-btn {
  background-color: #7f8c8d;
}

.lock-btn:hover {
  background-color: #95a5a6;
}

/* Contenido principal */
.main-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex-grow: 1;
  padding: 30px;
}

.status-card {
  background-color: white;
  border-radius: 12px;
  padding: 30px;
  width: 100%;
  max-width: 500px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
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
  margin-bottom: 25px;
  transition: all 0.3s ease;
}

.status-icon {
  font-size: 60px;
  margin-bottom: 15px;
}

.status-text {
  font-size: 20px;
  font-weight: 600;
}

.sin_servicio {
  background-color: #fff3e0;
  color: #e65100;
}

.en_servicio {
  background-color: #e3f2fd;
  color: #0d47a1;
}

.en_viaje_ureña, .en_viaje_colón {
  background-color: #e8f5e9;
  color: #1b5e20;
  animation: pulse 2s infinite;
}

.viaje_finalizado {
  background-color: #efebe9;
  color: #3e2723;
}

.timer-container {
  margin-top: 20px;
  opacity: 0;
  height: 0;
  overflow: hidden;
  transition: all 0.3s ease;
}

.timer-container.visible {
  opacity: 1;
  height: auto;
}

.timer {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background-color: #37474f;
  color: white;
  border-radius: 30px;
  font-weight: 600;
}

/* Botones de acción */
.action-buttons {
  display: flex;
  justify-content: center;
  width: 100%;
  max-width: 500px;
}

.action-btn {
  padding: 15px 25px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  gap: 10px;
}

.start-btn {
  background-color: #2ecc71;
  color: white;
}

.start-btn:hover {
  background-color: #27ae60;
  transform: translateY(-2px);
}

.trip-buttons {
  display: flex;
  gap: 15px;
  width: 100%;
}

.trip-btn {
  flex: 1;
  background-color: #3498db;
  color: white;
}

.trip-btn:hover {
  background-color: #2980b9;
  transform: translateY(-2px);
}

.end-btn {
  background-color: #e74c3c;
  color: white;
}

.end-btn:hover {
  background-color: #c0392b;
  transform: translateY(-2px);
}

.restart-btn {
  background-color: #f39c12;
  color: white;
}

.restart-btn:hover {
  background-color: #d35400;
  transform: translateY(-2px);
}

.error-message {
  padding: 15px;
  background-color: #ffebee;
  color: #c62828;
  border-radius: 6px;
  margin-bottom: 20px;
  font-weight: 600;
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(46, 204, 113, 0.4);
  }
  70% {
    box-shadow: 0 0 0 15px rgba(46, 204, 113, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(46, 204, 113, 0);
  }
}

/* Iconos de Font Awesome */
.fas {
  font-size: 18px;
}
</style>
