<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { writable } from 'svelte/store';
    import { supabase } from '../components/supabase';

    type ConductorUrena = {
        conductor_id: number;
        control: string;
        hora_inicio: string;
    };

    const conductoresEnUrena = writable<ConductorUrena[]>([]);
    let subscription: any;

    const obtenerHoraCaracas = (fechaISO: string) => {
        return new Date(fechaISO).toLocaleString('es-VE', { timeZone: 'America/Caracas' });
    };

    const obtenerConductoresEnUrena = async () => {
        try {
            const { data, error } = await supabase
                .from('viajes')
                .select('conductor_id, destino, hora_inicio')
                .order('hora_inicio', { ascending: false });

            if (error || !data) throw new Error('No se encontraron viajes');

            // 🔹 Mapear los viajes y filtrar los conductores que tienen viajes más recientes a "Colón"
            const conductoresMap = new Map<number, { destino: string; hora_inicio: string }>();

            data.forEach((viaje) => {
                if (!conductoresMap.has(viaje.conductor_id) || new Date(viaje.hora_inicio) > new Date(conductoresMap.get(viaje.conductor_id)!.hora_inicio)) {
                    conductoresMap.set(viaje.conductor_id, { destino: viaje.destino, hora_inicio: viaje.hora_inicio });
                }
            });

            // 🔍 Filtrar solo los conductores que tienen su último viaje a Ureña
            const conductoresUrenaIds = Array.from(conductoresMap.entries())
                .filter(([_, { destino }]) => destino === 'ureña')
                .map(([conductor_id]) => conductor_id);

            // 🔹 Obtener los datos de los conductores en Ureña
            const conductores = await Promise.all(
                conductoresUrenaIds.map(async (conductor_id) => {
                    const { data: conductorData, error: conductorError } = await supabase
                        .from('conductor')
                        .select('control')
                        .eq('id', conductor_id)
                        .single();

                    if (conductorError || !conductorData) return null;

                    return {
                        conductor_id,
                        control: conductorData.control,
                        hora_inicio: obtenerHoraCaracas(conductoresMap.get(conductor_id)!.hora_inicio),
                    };
                })
            );

            // 🔹 Filtrar resultados válidos
            const conductoresValidos: ConductorUrena[] = conductores.filter((conductor): conductor is ConductorUrena => conductor !== null);
            conductoresEnUrena.set(conductoresValidos);

            console.log('✅ Conductores en Ureña cargados:', conductoresValidos);
        } catch (err) {
            console.error('❌ Error al obtener conductores en Ureña:', err);
        }
    };

    onMount(async () => {
        await obtenerConductoresEnUrena();

        // 🔹 Escuchar cambios en tiempo real
        subscription = supabase
            .channel('viajes_updates')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'viajes' }, async (payload) => {
                if (payload.new.destino === 'ureña') {
                    console.log('📡 Nuevo viaje a Ureña detectado:', payload.new);
                    await obtenerConductoresEnUrena();
                } else if (payload.new.destino === 'colón') {
                    console.log('🛑 Viaje a Colón detectado, eliminando conductor:', payload.new.conductor_id);

                    // 🔥 Eliminar al conductor de la lista cuando inicia viaje a Colón
                    conductoresEnUrena.update((conductores) => {
                        return conductores.filter((conductor) => conductor.conductor_id !== payload.new.conductor_id);
                    });
                }
            })
            .subscribe();
    });

    onDestroy(() => {
        if (subscription) {
            console.log('🛑 Eliminando la suscripción a Supabase Realtime');
            supabase.removeChannel(subscription);
        }
    });
</script>



<div class="conductores-urena">
    <h2>🚖 Conductores en Ureña</h2>

    {#if $conductoresEnUrena.length === 0}
        <p>❌ No hay conductores con viajes recientes a Ureña.</p>
    {:else}
        <ul>
            {#each $conductoresEnUrena as conductor}
                <li>
                    <strong>🆔 Control:</strong> {conductor.control}  
                    <br>🕰️ Hora de inicio: {conductor.hora_inicio}
                </li>
            {/each}
        </ul>
    {/if}
</div>

