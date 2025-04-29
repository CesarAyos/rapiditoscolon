<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { writable } from 'svelte/store';
    import { supabase } from '../components/supabase';

    type ConductorSurtiendo = {
        conductor_id: number;
        control: string;
        hora_inicio: string;
    };

    const conductoresSurtiendo = writable<ConductorSurtiendo[]>([]);
    let subscription: any;

    const obtenerHoraCaracas = (fechaISO: string) => {
        return new Date(fechaISO).toLocaleString('es-VE', { timeZone: 'America/Caracas' });
    };

    const obtenerConductoresSurtiendo = async () => {
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

            const conductoresSurtiendoIds = Array.from(conductoresMap.entries())
                .filter(([_, { estado }]) => estado === 'surtiendo_combustible')
                .map(([conductor_id]) => conductor_id);

            const conductores = await Promise.all(
                conductoresSurtiendoIds.map(async (conductor_id) => {
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

            const conductoresValidos: ConductorSurtiendo[] = conductores.filter((conductor): conductor is ConductorSurtiendo => conductor !== null);
            conductoresSurtiendo.set(conductoresValidos);

            console.log('✅ Conductores surtiendo combustible cargados:', conductoresValidos);
        } catch (err) {
            console.error('❌ Error al obtener conductores surtiendo combustible:', err);
        }
    };

    onMount(async () => {
        await obtenerConductoresSurtiendo();

        subscription = supabase
            .channel('viajes_updates')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'viajes' }, async (payload) => {
                if (payload.new.estado === 'surtiendo_combustible') {
                    console.log('📡 Nuevo estado: Surtiendo combustible detectado:', payload.new);
                    await obtenerConductoresSurtiendo();
                } else if (payload.new.estado === 'llegando_de_surtir') {
                    console.log('🛑 Estado cambiado a llegando de surtir, eliminando conductor:', payload.new.conductor_id);

                    conductoresSurtiendo.update((conductores) => {
                        return conductores.filter((conductor) => conductor.conductor_id !== payload.new.conductor_id);
                    });
                }
            })
            .subscribe();
    });

    onDestroy(() => {
        if (subscription) {
            console.log('🛑 Eliminando la suscripción a Supabase Realtime');
        }
    });
</script>

<div class="conductores-surtiendo">
    <h2>⛽ Conductores surtiendo combustible</h2>

    {#if $conductoresSurtiendo.length === 0}
        <p>❌ No hay conductores surtiendo combustible.</p>
    {:else}
        <ul>
            {#each $conductoresSurtiendo as conductor}
                <li>
                    <strong>🆔 Control:</strong> {conductor.control}  
                    <br>🕰️ Hora de inicio: {conductor.hora_inicio}
                </li>
            {/each}
        </ul>
    {/if}
</div>
