<script lang="ts">
    import { onMount } from 'svelte';
    import { supabase } from '../components/supabase';
    import 'bootstrap/dist/css/bootstrap.min.css';

    interface Position {
        id: number;
        name: string;
        type: string;
        control: string;
        notes: string;
    }

    let positions: Position[] = [];
    let selectedControls: Set<string> = new Set(); // Para evitar repeticiones

    let date = new Date();
    let nextDay = new Date(date);
    nextDay.setDate(date.getDate() + 1);

    let selectedDate: string = nextDay.toISOString().split('T')[0];
    let isSaving: boolean = false;
    let saveMessage: { text: string; type: string } = { text: '', type: '' };

    // Generamos 17 puestos con tipado correcto
    for (let i = 1; i <= 17; i++) {
        positions.push({
            id: i,
            name: `Puesto ${i}`,
            type: i <= 14 ? 'turno' : 'emergente',
            control: '',
            notes: ''
        });
    }

    // Lista de controles disponibles
    const controls = Array.from({ length: 35 }, (_, i) => `Control ${String(i + 1).padStart(2, '0')}`);

    function handleSelection(position: Position, event: Event) {
        const selectedValue = (event.target as HTMLSelectElement).value;

        // Si el control ya fue seleccionado, no permitirlo
        if (selectedControls.has(selectedValue)) {
            (event.target as HTMLSelectElement).value = ''; // Resetear selección
            return;
        }

        // Limpiar el control previo si existía
        if (position.control) {
            selectedControls.delete(position.control);
        }

        // Asignar el nuevo control y guardarlo en el conjunto de seleccionados
        position.control = selectedValue;
        selectedControls.add(selectedValue);
    }

    async function saveShifts() {
        isSaving = true;
        saveMessage = { text: '', type: '' };

        const { error: deleteError } = await supabase
            .from('shifts')
            .delete()
            .eq('date', selectedDate);

        if (deleteError) {
            console.error('Error deleting old shifts:', deleteError);
        }

        const shiftsToInsert = positions
            .filter(pos => pos.control)
            .map(pos => ({
                date: selectedDate,
                position_id: pos.id,
                position_name: pos.name,
                position_type: pos.type,
                control: pos.control,
                notes: pos.notes
            }));

        const { error: insertError } = await supabase
            .from('shifts')
            .insert(shiftsToInsert);

        if (insertError) {
            console.error('Error saving shifts:', insertError);
            saveMessage = { text: 'Error al guardar los turnos', type: 'danger' };
        } else {
            saveMessage = { text: 'Turnos asignados', type: 'success' };

            // Limpiar el formulario
            positions.forEach(pos => {
                pos.control = '';
                pos.notes = '';
            });
            selectedControls.clear(); // Limpiar los controles seleccionados
        }

        isSaving = false;
    }
</script>

<div class="container-fluid p-3">
    <h1 class="h4 mb-3">Asignación de Turnos</h1>

    {#if saveMessage.text}
        <div class="alert alert-{saveMessage.type} mb-3">
            {saveMessage.text}
        </div>
    {/if}

    <!-- Lista de puestos de turno -->
    <div class="card mb-4">
        <div class="card-header bg-primary text-white">Puestos de Turno (1-14)</div>
        <div class="card-body p-0">
            <ul class="list-group list-group-flush">
                {#each positions.filter((p) => p.type === 'turno') as position (position.id)}
                    <li class="list-group-item">
                        <div class="row align-items-center">
                            <div class="col-3">
                                <strong>{position.name}</strong>
                            </div>
                            <div class="col-6">
                                <select class="form-select form-select-sm" on:change={event => handleSelection(position, event)}>
                                    <option value="">Seleccionar Control</option>
                                    {#each controls as control}
                                        <option value={control} disabled={selectedControls.has(control)}>{control}</option>
                                    {/each}
                                </select>
                            </div>
                            <div class="col-3">
                                <input
                                    type="text"
                                    class="form-control form-control-sm"
                                    placeholder="Notas"
                                    bind:value={position.notes}
                                />
                            </div>
                        </div>
                    </li>
                {/each}
            </ul>
        </div>
    </div>

    <!-- Puestos emergentes -->
    <div class="card mb-4">
        <div class="card-header bg-warning text-dark">Puestos Emergentes (15-17)</div>
        <div class="card-body p-0">
            <ul class="list-group list-group-flush">
                {#each positions.filter((p) => p.type === 'emergente') as position (position.id)}
                    <li class="list-group-item">
                        <div class="row align-items-center">
                            <div class="col-3">
                                <strong>{position.name}</strong>
                            </div>
                            <div class="col-6">
                                <select class="form-select form-select-sm" on:change={event => handleSelection(position, event)}>
                                    <option value="">Seleccionar Control</option>
                                    {#each controls as control}
                                        <option value={control} disabled={selectedControls.has(control)}>{control}</option>
                                    {/each}
                                </select>
                            </div>
                            <div class="col-3">
                                <input
                                    type="text"
                                    class="form-control form-control-sm"
                                    placeholder="Notas"
                                    bind:value={position.notes}
                                />
                            </div>
                        </div>
                    </li>
                {/each}
            </ul>
        </div>
    </div>

    <!-- Botón de guardar -->
    <div class="d-grid gap-2">
        <button class="btn btn-success" on:click={saveShifts} disabled={isSaving}>
            {isSaving ? 'Guardando...' : 'Guardar Turnos'}
        </button>
    </div>
</div>

<style>
    /* Estilos para móviles */
    @media (max-width: 576px) {
        .list-group-item .row > div {
            padding: 0.25rem;
        }
        .form-select,
        .form-control {
            font-size: 0.8rem;
        }
    }
</style>
