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
		window.location.href = '/';
	};
</script>

<div class="z-3">
    <button 
      class="btn-logout btn-danger btn btn-sm btn-circle" 
      on:click={handleLogout} 
      aria-label="Cerrar sesión"
    >
      Cerrar sesión
    </button>
  </div>
