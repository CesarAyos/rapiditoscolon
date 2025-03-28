<script>
	import { supabase } from "./supabase";


    const handleLogout = async () => {
		await supabase.auth.signOut();
		localStorage.clear();
		document.cookie.split(';').forEach((c) => {
			document.cookie = c
				.replace(/^ +/, '')
				.replace(/=.*/, '=;expires=' + new Date().toUTCString() + ';path=/');
		});
		window.location.href = '/auth';
	};
</script>

<div class="z-3">
    <button 
      class="btn-logout" 
      on:click={handleLogout} 
      aria-label="Cerrar sesión"
    >
      Cerrar sesión
    </button>
  </div>

  <style>
     .btn-logout {
    background-color: #ffd43b; /* Color del botón */
    color: #000; /* Color del texto */
    border: none; /* Sin borde */
    border-radius: 5px; /* Bordes redondeados */
    padding: 10px 20px; /* Espaciado interno */
    cursor: pointer; /* Cambia el cursor al pasar sobre el botón */
    font-size: 16px; /* Tamaño del texto */
    transition: background-color 0.3s ease; /* Animación al pasar el ratón */
  }

  .btn-logout:hover {
    background-color: #ffa500; /* Color al pasar el ratón */
  }

  .btn-logout:active {
    background-color: #ff8c00; /* Color al hacer clic */
  }
  </style>