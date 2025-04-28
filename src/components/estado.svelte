<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { writable } from 'svelte/store';
  import { supabase } from '../components/supabase';

  type Conductor = {
      id: number;
      nombre: string;
      placa: string;
      control: string;
      propiedad: string;
      telefono?: string | null;
  };

  const conductor = writable<Conductor | null>(null);
  const estadoActual = writable<string>('sin_servicio');
  const tiempoTranscurrido = writable<number>(0);
  const destinoUltimoViaje = writable<string>('Desconocido');
  const horaInicioViaje = writable<string>('N/A');
  const horaFinViaje = writable<string>('N/A');
  const duracionTotalViaje = writable<string>('N/A');
  let subscription: any;

  const obtenerHoraCaracas = (fechaISO?: string) => {
      if (fechaISO) {
          return new Date(fechaISO).toLocaleString("es-VE", { timeZone: "America/Caracas" });
      }
      return new Date().toLocaleString("es-VE", { timeZone: "America/Caracas" });
  };

  const obtenerConductor = async () => {
      try {
          const { data: sessionData } = await supabase.auth.getSession();
          if (!sessionData.session?.user?.email) throw new Error("No hay sesión activa");

          const { data, error } = await supabase
              .from("conductor")
              .select("*")
              .eq("email", sessionData.session.user.email)
              .single();

          if (error || !data) throw new Error("No se encontró el conductor");

          conductor.set(data);
          console.log("✅ Conductor cargado correctamente:", data);

          await obtenerUltimoViaje(data.id);
      } catch (err) {
          console.error("Error al cargar conductor:", err);
      }
  };

  const obtenerUltimoViaje = async (conductor_id: number) => {
      try {
          const { data, error } = await supabase
              .from("viajes")
              .select("estado, duracion_total, destino, hora_inicio, hora_fin")
              .eq("conductor_id", conductor_id)
              .order("hora_inicio", { ascending: false })
              .limit(1)
              .maybeSingle();

          if (error || !data) throw new Error("No se encontró un viaje reciente");

          console.log("✅ Datos obtenidos del último viaje:", data);

          estadoActual.set(data.estado);
          tiempoTranscurrido.set(data.duracion_total || 0);
          destinoUltimoViaje.set(data.destino || "Desconocido");
          horaInicioViaje.set(data.hora_inicio ? obtenerHoraCaracas(data.hora_inicio) : "N/A");
          horaFinViaje.set(data.hora_fin ? obtenerHoraCaracas(data.hora_fin) : "N/A");
          duracionTotalViaje.set(data.duracion_total ? `${data.duracion_total} segundos` : "N/A");
      } catch (err) {
          console.error("❌ Error al obtener el viaje:", err);
      }
  };

  onMount(async () => {
      await obtenerConductor();

      subscription = supabase
          .channel("viajes_updates")
          .on("postgres_changes", { event: "INSERT", schema: "public", table: "viajes" }, async (payload) => {
              console.log("📡 Nuevo viaje detectado en tiempo real:", payload.new);

              estadoActual.set(payload.new.estado);
              tiempoTranscurrido.set(payload.new.duracion_total || 0);
              destinoUltimoViaje.set(payload.new.destino || "Desconocido");
              horaInicioViaje.set(payload.new.hora_inicio ? obtenerHoraCaracas(payload.new.hora_inicio) : "N/A");
              horaFinViaje.set(payload.new.hora_fin ? obtenerHoraCaracas(payload.new.hora_fin) : "N/A");
              duracionTotalViaje.set(payload.new.duracion_total ? `${payload.new.duracion_total} segundos` : "N/A");

              console.log("✅ Datos actualizados en la interfaz:", {
                  estado: payload.new.estado,
                  destino: payload.new.destino,
                  hora_inicio: payload.new.hora_inicio,
                  hora_fin: payload.new.hora_fin,
                  duracion_total: payload.new.duracion_total
              });
          })
          .subscribe();
  });

  onDestroy(() => {
      if (subscription) {
          console.log("🛑 Eliminando la suscripción a Supabase Realtime");
          supabase.removeChannel(subscription);
      }
  });
</script>

<div class="conductor-info">
  <h2>🚖 Información del Conductor</h2>

  {#if $conductor}
      <div class="info-panel">
          <p><strong>🆔 Control:</strong> {$conductor.control}</p>
          <p><strong>👤 Nombre:</strong> {$conductor.nombre}</p>
          <p><strong>🚗 Placa:</strong> {$conductor.placa}</p>
          <p><strong>☎️ Teléfono:</strong> {$conductor.telefono || 'No disponible'}</p>
      </div>
  {:else}
      <p>❌ No se encontró información del conductor.</p>
  {/if}

  <h3>📌 Estado Actual del Viaje</h3>
  <p class="estado">Estado: <strong>{$estadoActual}</strong></p>

  {#if $estadoActual === "finalizado"}
      <div class="destino">
          <p>📍 Último destino: <strong>{$destinoUltimoViaje}</strong></p>
          <p>🕰️ Inicio del viaje: <strong>{$horaInicioViaje}</strong></p>
          <p>🕰️ Finalización del viaje: <strong>{$horaFinViaje}</strong></p>
          <p>⏳ Duración total: <strong>{$duracionTotalViaje}</strong></p>
      </div>
  {/if}

 
</div>


<style>
  .conductor-info {
    max-width: 600px;
    margin: 2rem auto;
    padding: 2rem;
    border-radius: 12px;
    background-color: #ffffff;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    color: #333;
}

.conductor-info h2, .conductor-info h3 {
    color: #2c3e50;
    margin-bottom: 1rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.conductor-info h2 {
    font-size: 1.5rem;
    border-bottom: 2px solid #3498db;
    padding-bottom: 0.5rem;
    margin-bottom: 1.5rem;
}

.conductor-info h3 {
    font-size: 1.2rem;
    margin-top: 1.5rem;
    color: #3498db;
}

.info-panel {
    background-color: #f8f9fa;
    padding: 1.2rem;
    border-radius: 8px;
    border-left: 4px solid #3498db;
    margin-bottom: 1.5rem;
}

.info-panel p {
    margin: 0.7rem 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.estado {
    background-color: #e8f4fc;
    padding: 0.8rem;
    border-radius: 6px;
    font-size: 1.1rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.estado strong {
    color: #2980b9;
    text-transform: capitalize;
}



.conductor-info > p {
    background-color: #f8f9fa;
    padding: 0.8rem;
    border-radius: 6px;
    margin: 1rem 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.conductor-info > p strong {
    color: #16a085;
}
</style>
