<script lang="ts">
    import { onMount } from 'svelte';
    import { supabase } from '../components/supabase';
    import 'bootstrap/dist/css/bootstrap.min.css';

    interface Shift {
        id: number;
        date: string;
        position_id: number;
        position_name: string;
        position_type: string;
        control: string;
        notes: string;
    }

    let shifts: Shift[] = [];
    let selectedDate: string = new Date().toISOString().split('T')[0];
    let isLoading: boolean = false;
    let errorMessage: string = '';

    async function loadShifts() {
        isLoading = true;
        errorMessage = '';

        const { data, error } = await supabase
            .from('shifts')
            .select('*')
            .eq('date', selectedDate)
            .order('position_id', { ascending: true });

        if (error) {
            console.error('Error loading shifts:', error);
            errorMessage = 'Error al cargar los turnos';
            isLoading = false;
            return;
        }

        shifts = data as Shift[];
        isLoading = false;
    }

    onMount(() => {
        loadShifts();
    });

    $: if (selectedDate) {
        loadShifts();
    }
</script>

<div class="container-fluid p-3">
    <h1 class="h4 mb-3">Turnos Asignados</h1>

    <!-- Selector de fecha -->
    <div class="row mb-3">
        <div class="col-12">
            <label for="shiftDate" class="form-label">Fecha del turno:</label>
            <input 
                type="date" 
                id="shiftDate" 
                class="form-control" 
                bind:value={selectedDate}
                on:change={loadShifts}
            />
        </div>
    </div>

    <!-- Mensaje de error -->
    {#if errorMessage}
        <div class="alert alert-danger mb-3">
            {errorMessage}
        </div>
    {/if}

    <!-- Turnos Emergentes -->
    <div class="card mb-4">
        <div class="card-header bg-warning text-dark">Turnos Emergentes</div>
        <div class="card-body p-0">
            {#if isLoading}
                <div class="text-center p-3">Cargando turnos...</div>
            {:else}
                {#if shifts.filter(s => s.position_type === 'emergente').length > 0}
                    <ul class="list-group list-group-flush">
                        {#each shifts.filter(s => s.position_type === 'emergente') as shift (shift.id)}
                            <li class="list-group-item">
                                <div class="row align-items-center">
                                    <div class="col-3">
                                        <strong>{shift.position_name}</strong>
                                    </div>
                                    <div class="col-3">
                                        <span class="badge bg-warning text-dark">{shift.position_type}</span>
                                    </div>
                                    <div class="col-3">
                                        <span class="badge bg-info">{shift.control}</span>
                                    </div>
                                    <div class="col-3">
                                        <small>{shift.notes}</small>
                                    </div>
                                </div>
                            </li>
                        {/each}
                    </ul>
                {:else}
                    <div class="text-center p-3">No hay turnos emergentes asignados.</div>
                {/if}
            {/if}
        </div>
    </div>

    <!-- Turnos Regulares -->
    <div class="card mb-4">
        <div class="card-header bg-primary text-white">Turnos Regulares</div>
        <div class="card-body p-0">
            {#if isLoading}
                <div class="text-center p-3">Cargando turnos...</div>
            {:else}
                {#if shifts.filter(s => s.position_type === 'turno').length > 0}
                    <ul class="list-group list-group-flush">
                        {#each shifts.filter(s => s.position_type === 'turno') as shift (shift.id)}
                            <li class="list-group-item">
                                <div class="row align-items-center">
                                    <div class="col-3">
                                        <strong>{shift.position_name}</strong>
                                    </div>
                                    <div class="col-3">
                                        <span class="badge bg-primary">{shift.position_type}</span>
                                    </div>
                                    <div class="col-3">
                                        <span class="badge bg-info">{shift.control}</span>
                                    </div>
                                    <div class="col-3">
                                        <small>{shift.notes}</small>
                                    </div>
                                </div>
                            </li>
                        {/each}
                    </ul>
                {:else}
                    <div class="text-center p-3">No hay turnos regulares asignados.</div>
                {/if}
            {/if}
        </div>
    </div>
</div>

<style>
    /* Estilos para móviles */
    @media (max-width: 576px) {
        .list-group-item .row > div {
            padding: 0.25rem;
        }
    }
</style>
