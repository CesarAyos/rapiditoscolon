<script>
    import { onMount } from 'svelte';

    let accesoPermitido = false; // Estado inicial de acceso
    let clave = '';

    // Comprobar el estado de acceso al montar el componente
    onMount(() => {
        if (localStorage.getItem('accesoPermitido') === 'true') {
            accesoPermitido = true; // Establecer acceso permitido desde localStorage
        }
    });

    function verificarClave() {
        if (clave === 'colon2025') {
            accesoPermitido = true;

            // Guardar el estado en localStorage
            localStorage.setItem('accesoPermitido', 'true');
        } else {
            alert('Clave incorrecta, intenta de nuevo.');
        }
    }
</script>

{#if accesoPermitido}
    <slot />
{:else}
    <div class="auth-container">
        <div class="auth-card">
            <div class="auth-header">
                <svg class="auth-icon" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M12,3A4,4 0 0,0 8,7V9H6V7A6,6 0 0,1 12,1A6,6 0 0,1 18,7V9H16V7A4,4 0 0,0 12,3M12,13C10.9,13 10,13.9 10,15V19C10,20.1 10.9,21 12,21C13.1,21 14,20.1 14,19V15C14,13.9 13.1,13 12,13M19,13C17.9,13 17,13.9 17,15V19C17,20.1 17.9,21 19,21C20.1,21 21,20.1 21,19V15C21,13.9 20.1,13 19,13M5,13C3.9,13 3,13.9 3,15V19C3,20.1 3.9,21 5,21C6.1,21 7,20.1 7,19V15C7,13.9 6.1,13 5,13Z" />
                </svg>
                <h2 class="auth-title">Área Protegida</h2>
                <p class="auth-subtitle">Ingresa la clave de acceso para continuar</p>
            </div>

            <div class="auth-form">
                <div class="input-group">
                    <input 
                        type="password" 
                        bind:value={clave} 
                        placeholder=" "
                        class="auth-input"
                        id="passwordInput"
                    />
                    <label for="passwordInput" class="auth-label">Contraseña</label>
                    <div class="input-underline"></div>
                </div>

                <button on:click={verificarClave} class="auth-button">
                    <span class="button-text">Verificar</span>
                    <svg class="button-icon" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M4,11V13H16L10.5,18.5L11.92,19.92L19.84,12L11.92,4.08L10.5,5.5L16,11H4Z" />
                    </svg>
                </button>
            </div>
        </div>
    </div>
{/if}


<style>
    .auth-container {
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 100vh;
        padding: 2rem;
        background: linear-gradient(135deg, #f5f7fa 0%, #e4e8f0 100%);
    }

    .auth-card {
        background: white;
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
        padding: 2.5rem;
        width: 100%;
        max-width: 400px;
        transition: transform 0.3s ease, box-shadow 0.3s ease;
    }

    .auth-card:hover {
        transform: translateY(-5px);
        box-shadow: 0 15px 35px rgba(0, 0, 0, 0.12);
    }

    .auth-header {
        text-align: center;
        margin-bottom: 2rem;
    }

    .auth-icon {
        width: 48px;
        height: 48px;
        color: #3f51b5;
        margin-bottom: 1rem;
    }

    .auth-title {
        font-size: 1.5rem;
        font-weight: 600;
        color: #2d3748;
        margin-bottom: 0.5rem;
    }

    .auth-subtitle {
        color: #718096;
        font-size: 0.875rem;
        margin: 0;
    }

    .auth-form {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }

    .input-group {
        position: relative;
    }

    .auth-input {
        width: 100%;
        padding: 1rem 0.5rem 0.5rem;
        border: none;
        border-radius: 0;
        background-color: transparent;
        border-bottom: 1px solid #e2e8f0;
        font-size: 1rem;
        transition: all 0.3s ease;
    }

    .auth-input:focus {
        outline: none;
        border-color: #3f51b5;
    }

    .auth-input:focus + .auth-label,
    .auth-input:not(:placeholder-shown) + .auth-label {
        transform: translateY(-1.25rem) scale(0.85);
        color: #3f51b5;
    }

    .auth-label {
        position: absolute;
        top: 1rem;
        left: 0.5rem;
        color: #718096;
        transition: all 0.3s ease;
        pointer-events: none;
    }

    .input-underline {
        position: absolute;
        bottom: 0;
        left: 0;
        width: 0;
        height: 2px;
        background-color: #3f51b5;
        transition: width 0.3s ease;
    }

    .auth-input:focus ~ .input-underline {
        width: 100%;
    }

    .auth-button {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        background: #3f51b5;
        color: white;
        border: none;
        padding: 0.75rem 1.5rem;
        border-radius: 8px;
        font-size: 1rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.3s ease;
        box-shadow: 0 4px 6px rgba(63, 81, 181, 0.1);
    }

    .auth-button:hover {
        background: #334296;
        transform: translateY(-2px);
        box-shadow: 0 7px 14px rgba(63, 81, 181, 0.15);
    }

    .auth-button:active {
        transform: translateY(0);
    }

    .button-icon {
        width: 20px;
        height: 20px;
        transition: transform 0.3s ease;
    }

    .auth-button:hover .button-icon {
        transform: translateX(3px);
    }
</style>
