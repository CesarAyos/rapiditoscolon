<script lang="ts">
    import { onMount } from 'svelte';
    import { supabase } from '../components/supabase';
  
    // Define la interfaz para los datos de sugerencia
    interface Sugerencia {
      id: string;
      cliente_id: string | null;
      primernombre: string | null;
      primerapellido: string | null;
      telefono: string | null;
      sugerencia: string;
      tipo: string | null;
      fecha_creacion: string;
      leido: boolean;
    }
  
    let datos: Sugerencia[] = [];
    let loading: boolean = true;
    let error: string | null = null;
  
    onMount(async () => {
      try {
        const { data, error: supabaseError } = await supabase
          .from('sugerencias_usuarios') // Reemplaza con tu nombre de tabla real
          .select('*')
          .order('fecha_creacion', { ascending: false });
  
        if (supabaseError) throw supabaseError;
  
        datos = data as Sugerencia[];
      } catch (err) {
        error = err instanceof Error ? err.message : 'Error desconocido';
      } finally {
        loading = false;
      }
    });
  </script>
  
  <div class="container">
    <h1>Datos de la Tabla</h1>
  
    {#if loading}
      <p>Cargando datos...</p>
    {:else if error}
      <p class="error">Error: {error}</p>
    {:else}
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Cliente ID</th>
              <th>Nombre</th>
              <th>Apellido</th>
              <th>Teléfono</th>
              <th>Sugerencia</th>
              <th>Tipo</th>
              <th>Fecha Creación</th>
              <th>Leído</th>
            </tr>
          </thead>
          <tbody>
            {#each datos as item}
              <tr class:leido={item.leido}>
                <td>{item.id.slice(0, 8)}...</td>
                <td>{item.cliente_id?.slice(0, 8)}...</td>
                <td>{item.primernombre}</td>
                <td>{item.primerapellido}</td>
                <td>{item.telefono}</td>
                <td>{item.sugerencia}</td>
                <td>{item.tipo}</td>
                <td>{new Date(item.fecha_creacion).toLocaleString()}</td>
                <td>{item.leido ? '✅' : '❌'}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
  
  <style>
    /* Tus estilos permanecen igual */
    .container {
      max-width: 100%;
      overflow-x: auto;
      padding: 1rem;
    }
  
    .table-container {
      margin-top: 1rem;
    }
  
    table {
      width: 100%;
      border-collapse: collapse;
      font-family: sans-serif;
    }
  
    th, td {
      padding: 0.75rem;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }
  
    th {
      background-color: #f2f2f2;
      position: sticky;
      top: 0;
    }
  
    tr:hover {
      background-color: #f5f5f5;
    }
  
    tr.leido {
      background-color: #f0fff0;
    }
  
    .error {
      color: #ff3333;
    }
  </style>