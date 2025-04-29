<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { writable } from 'svelte/store';
    import { supabase } from '../components/supabase';

    type ConductorParrilla = {
        conductor_id: number;
        control: string;
        hora_inicio: string;
    };

    const conductoresEnParrilla = writable<ConductorParrilla[]>([]);
    let subscription: any;

    const obtenerHoraCaracas = (fechaISO: string) => {
        return new Date(fechaISO).toLocaleString('es-VE', { timeZone: 'America/Caracas' });
    };

    const obtenerConductoresEnParrilla = async () => {
        try {
            const { data, error } = await supabase
                .from('viajes')
                .select('conductor_id, estado, hora_inicio')
                .order('hora_inicio', { ascending: false });

            if (error || !data) throw new Error('No se encontraron viajes');

            const conductoresMap = new Map<number, { estado: string; hora_inicio: string }>();

            data.forEach((viaje) => {
                if (!conductoresMap.has(viaje.conductor_id) || new Date(viaje.hora_inicio) > new Date(conductoresMap.get(viaje.conductor_id)!.hora_inicio)) {
                    conductoresMap.set(viaje.conductor_id, { estado: viaje.estado, hora_inicio: viaje.hora_inicio });
                }
            });

            const conductoresParrillaIds = Array.from(conductoresMap.entries())
                .filter(([_, { estado }]) => estado === 'en_parrilla')
                .map(([conductor_id]) => conductor_id);

            const conductores = await Promise.all(
                conductoresParrillaIds.map(async (conductor_id) => {
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

            const conductoresValidos: ConductorParrilla[] = conductores.filter((conductor): conductor is ConductorParrilla => conductor !== null);
            conductoresEnParrilla.set(conductoresValidos);

            console.log('✅ Conductores en parrilla cargados:', conductoresValidos);
        } catch (err) {
            console.error('❌ Error al obtener conductores en parrilla:', err);
        }
    };

    onMount(async () => {
        await obtenerConductoresEnParrilla();

        subscription = supabase
            .channel('viajes_updates')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'viajes' }, async (payload) => {
                if (payload.new.estado === 'en_parrilla') {
                    console.log('📡 Nuevo estado: En parrilla detectado:', payload.new);
                    await obtenerConductoresEnParrilla();
                } else {
                    console.log('🛑 Estado cambiado, eliminando conductor:', payload.new.conductor_id);

                    conductoresEnParrilla.update((conductores) => {
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

<div class="conductores-parrilla">
    <h2>🔥 Conductores en parrilla</h2>

    {#if $conductoresEnParrilla.length === 0}
        <p>❌ No hay conductores en parrilla.</p>
    {:else}
        <ul>
            {#each $conductoresEnParrilla as conductor}
                <li>
                    <strong>🆔 Control:</strong> {conductor.control}  
                    <br>🕰️ Hora de inicio: {conductor.hora_inicio}
                </li>
            {/each}
        </ul>
    {/if}
</div>
