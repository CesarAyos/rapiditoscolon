<script>
  import { supabase } from "../../components/supabase";

  let email = "";
  let password = "";
  let userType = "pasajero"; // Valor predeterminado: "pasajero"
  let rememberMe = false;
  let isLoading = false;
  let errorMessage = "";

  const handleLogin = async () => {
    isLoading = true;
    errorMessage = "";

    // Validar campos
    if (!email || !password || !userType) {
      errorMessage = "Por favor, ingresa tu email, contraseña y selecciona un tipo de usuario.";
      isLoading = false;
      return;
    }

    try {

      // Definir la tabla según el tipo de usuario seleccionado
      const tableName = userType === "conductor" ? "conductor" : "pasajero";

      // Consultar la tabla para verificar credenciales
      const { data, error } = await supabase
        .from(tableName)
        .select("*")
        .eq("email", email)
        .eq("password", password); // Comparación directa

      isLoading = false;

      if (error || data.length === 0) {
        errorMessage = "Credenciales inválidas. Verifica tu email y contraseña.";
        return;
      }

      // Usuario encontrado
      const user = data[0];

      alert(`¡Bienvenido, ${user.nombre || user.email}!\nRedirigiendo...`);

      // Guardar sesión si "Recordarme" está activado
      if (rememberMe) {
        localStorage.setItem("user", JSON.stringify(user));
      }

      // Redirigir según el tipo de usuario
      const redirectUrl =
        userType === "conductor"
          ? "/auth/dashboard-conductor"
          : "/auth/dashboard-pasajero";

      window.location.href = redirectUrl;
    } catch (err) {
      console.error("Error durante el login:", err);
      errorMessage = "Ocurrió un error. Intenta de nuevo más tarde.";
      isLoading = false;
    }
  };
</script>

<div class="wrapper">
  <div class="scroll-container">
    <div class="container animate-fall">
      <h1 class="title">Acceso a Rapiditos Colón</h1>
      <p class="subtitle">Ingresa con tus credenciales</p>

      <form on:submit|preventDefault={handleLogin} class="login-form">
        <!-- Selector de tipo de usuario -->
        <div class="user-type-selector">
          <label class="user-type-option {userType === 'pasajero' ? 'active' : ''}">
            <input 
              type="radio" 
              name="userType" 
              bind:group={userType} 
              value="pasajero" 
            />
            <span class="user-type-label">👤 Pasajero</span>
          </label>
          
          <label class="user-type-option {userType === 'conductor' ? 'active' : ''}">
            <input 
              type="radio" 
              name="userType" 
              bind:group={userType} 
              value="conductor" 
            />
            <span class="user-type-label">🚗 Conductor</span>
          </label>
        </div>

        <!-- Campos de login -->
        <div class="form-group">
          <label for="email">Correo electrónico</label>
          <input
            id="email"
            type="email"
            bind:value={email}
            placeholder="tu@email.com"
            required
          />
          <div class="underline"></div>
        </div>

        <div class="form-group">
          <label for="password">Contraseña</label>
          <div class="password-input">
            <input
              id="password"
              type="password"
              bind:value={password}
              placeholder="••••••••"
              minlength="6"
              required
            />
            <div class="underline"></div>
          </div>
        </div>

        <!-- Opciones adicionales -->
        <div class="login-options">
          <label class="remember-me">
            <input type="checkbox" bind:checked={rememberMe} />
            <span class="checkmark"></span>
            Recordar sesión
          </label>
          
          <a href="/recuperar-contrasena" class="forgot-password">
            ¿Olvidaste tu contraseña?
          </a>
        </div>

        <!-- Mensaje de error -->
        {#if errorMessage}
          <div class="error-message">
            ⚠️ {errorMessage}
          </div>
        {/if}

        <!-- Botón de submit -->
        <button type="submit" class="btn-submit" disabled={isLoading}>
          {#if isLoading}
            <span class="spinner"></span>
          {:else}
            <span class="btn-icon">{userType === 'conductor' ? '🚗' : '👤'}</span>
            <span>Ingresar como {userType}</span>
          {/if}
        </button>

        <!-- Enlace a registro -->
        <div class="register-link">
          ¿No tienes cuenta? 
          <a href={userType === 'conductor' ? '/conductor' : '/pasajero'}>
            Regístrate aquí
          </a>
        </div>
      </form>

      <!-- Elementos decorativos -->
      <div class="floating-elements">
        <div class="circle circle-1"></div>
        <div class="circle circle-2"></div>
      </div>
    </div>
  </div>
</div>

  
  <style>
    /* ================ ESTILOS GLOBALES ================ */
    :global(body) {
      font-family: 'Poppins', sans-serif;
      background: linear-gradient(135deg, #f3f4f6, #0f0f0f);
      height: 100vh;
      margin: 0;
      padding: 0;
      overflow-x: hidden;
    }
  
    /* ================ ESTRUCTURA PRINCIPAL ================ */
    .wrapper {
      height: 100vh;
      overflow-y: auto;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      padding: 20px 0;
    }
  
    .scroll-container {
      width: 100%;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
  
    .container {
      background: rgba(255, 255, 255, 0.2);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.18);
      width: 90%;
      max-width: 500px;
      margin: 2rem auto;
      padding: 2rem;
      border-radius: 20px;
      box-shadow: 
        0 8px 32px rgba(31, 38, 135, 0.15),
        0 4px 16px rgba(0, 0, 0, 0.1);
      animation: fallDown 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
      opacity: 0;
      transform: translateY(-30px);
      position: relative;
      z-index: 10;
    }
  
    /* ================ ANIMACIONES ================ */
    @keyframes fallDown {
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  
    @keyframes float {
      0%, 100% {
        transform: translateY(0) rotate(0deg);
      }
      50% {
        transform: translateY(-15px) rotate(5deg);
      }
    }
  
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      20%, 60% { transform: translateX(-5px); }
      40%, 80% { transform: translateX(5px); }
    }
  
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  
    /* ================ TIPOGRAFÍA ================ */
    .title {
      font-size: 2rem;
      font-weight: 700;
      color: #fff;
      text-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      margin-bottom: 0.8rem;
      text-align: center;
      position: relative;
      padding-bottom: 12px;
    }
  
    .title::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 60px;
      height: 3px;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.7), transparent);
      border-radius: 3px;
    }
  
    .subtitle {
      font-size: 1rem;
      color: rgba(255, 255, 255, 0.85);
      font-weight: 300;
      text-align: center;
      margin-bottom: 2rem;
    }
  
    /* ================ FORMULARIO LOGIN ================ */
    .login-form {
      max-width: 400px;
      margin: 0 auto;
    }
  
    /* Selector de tipo de usuario */
    .user-type-selector {
      display: flex;
      gap: 12px;
      margin-bottom: 2rem;
      justify-content: center;
    }
  
    .user-type-option {
      flex: 1;
      text-align: center;
      padding: 14px 0;
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.3s ease;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.25);
    }
  
    .user-type-option:hover {
      background: rgba(255, 255, 255, 0.15);
    }
  
    .user-type-option.active {
      background: rgba(255, 255, 255, 0.25);
      border-color: white;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
    }
  
    .user-type-option input {
      display: none;
    }
  
    .user-type-label {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      font-weight: 500;
      color: white;
      font-size: 0.95rem;
    }
  
    /* Campos de formulario */
    .form-group {
      position: relative;
      margin-bottom: 1.8rem;
    }
  
    label {
      display: block;
      margin-bottom: 0.6rem;
      color: rgba(255, 255, 255, 0.85);
      font-size: 0.95rem;
      font-weight: 400;
    }
  
    input {
      width: 100%;
      padding: 12px 0;
      background: transparent;
      border: none;
      border-bottom: 1px solid rgba(255, 255, 255, 0.3);
      color: white;
      font-size: 1rem;
      outline: none;
      transition: all 0.3s ease;
    }
  
    input::placeholder {
      color: rgba(255, 255, 255, 0.5);
      font-size: 0.95rem;
    }
  
    input:focus {
      border-bottom-color: rgba(255, 255, 255, 0.8);
    }
  
    .underline {
      position: absolute;
      bottom: 0;
      left: 0;
      width: 0;
      height: 2px;
      background: white;
      transition: width 0.4s ease;
    }
  
    input:focus ~ .underline {
      width: 100%;
    }
  
    /* Opciones adicionales */
    .login-options {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin: 1.8rem 0;
      font-size: 0.9rem;
    }
  
    .remember-me {
      display: flex;
      align-items: center;
      gap: 8px;
      color: rgba(255, 255, 255, 0.8);
      cursor: pointer;
      user-select: none;
    }
  
    .remember-me input {
      display: none;
    }
  
    .checkmark {
      width: 18px;
      height: 18px;
      border: 2px solid rgba(255, 255, 255, 0.5);
      border-radius: 4px;
      display: inline-block;
      position: relative;
      transition: all 0.3s;
    }
  
    .remember-me input:checked + .checkmark {
      background: rgba(255, 255, 255, 0.3);
      border-color: white;
    }
  
    .checkmark:after {
      content: "✓";
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%) scale(0);
      transition: transform 0.2s;
      color: white;
      font-size: 0.8rem;
    }
  
    .remember-me input:checked + .checkmark:after {
      transform: translate(-50%, -50%) scale(1);
    }
  
    .forgot-password {
      color: rgba(255, 255, 255, 0.7);
      text-decoration: none;
      transition: color 0.3s;
      font-size: 0.9rem;
    }
  
    .forgot-password:hover {
      color: white;
      text-decoration: underline;
    }
  
    /* Mensaje de error */
    .error-message {
      background: rgba(255, 0, 0, 0.15);
      color: #ffdddd;
      padding: 12px 15px;
      border-radius: 8px;
      margin-bottom: 1.5rem;
      font-size: 0.9rem;
      border-left: 3px solid #ff6b6b;
      animation: shake 0.5s;
      display: flex;
      align-items: center;
      gap: 8px;
    }
  
    /* Botón de submit */
    .btn-submit {
      background: linear-gradient(135deg, rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0.1));
      color: white;
      border: none;
      padding: 16px 28px;
      border-radius: 50px;
      font-weight: 600;
      letter-spacing: 0.5px;
      transition: all 0.4s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      margin: 0 auto;
      cursor: pointer;
      width: 100%;
      backdrop-filter: blur(5px);
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
      font-size: 1rem;
    }
  
    .btn-submit:hover:not(:disabled) {
      background: linear-gradient(135deg, rgba(255, 255, 255, 0.25), rgba(255, 255, 255, 0.15));
      transform: translateY(-3px);
      box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
    }
  
    .btn-submit:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }
  
    .btn-icon {
      font-size: 1.2rem;
    }
  
    .spinner {
      width: 20px;
      height: 20px;
      border: 3px solid rgba(255, 255, 255, 0.3);
      border-radius: 50%;
      border-top-color: white;
      animation: spin 1s ease-in-out infinite;
    }
  
    /* Enlace de registro */
    .register-link {
      text-align: center;
      margin-top: 2rem;
      color: rgba(255, 255, 255, 0.7);
      font-size: 0.95rem;
    }
  
    .register-link a {
      color: white;
      font-weight: 500;
      margin-left: 5px;
      text-decoration: none;
      transition: all 0.3s;
    }
  
    .register-link a:hover {
      text-decoration: underline;
    }
  
    /* ================ ELEMENTOS DECORATIVOS ================ */
    .floating-elements {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      z-index: -1;
      pointer-events: none;
    }
  
    .circle {
      position: absolute;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.08);
      animation: float 12s infinite ease-in-out;
      filter: blur(1px);
    }
  
    .circle-1 {
      width: 120px;
      height: 120px;
      top: 15%;
      left: 10%;
      animation-delay: 0s;
    }
  
    .circle-2 {
      width: 180px;
      height: 180px;
      top: 65%;
      left: 75%;
      animation-delay: 2s;
      animation-duration: 15s;
    }
  
    /* ================ RESPONSIVE ================ */
    @media (max-width: 768px) {
      .container {
        width: 90%;
        padding: 1.8rem !important;
      }
  
      .title {
        font-size: 1.8rem;
      }
  
      .user-type-selector {
        flex-direction: column;
      }
    }
  
    @media (max-width: 480px) {
      .container {
        padding: 1.5rem !important;
        width: 95%;
      }
  
      .title {
        font-size: 1.6rem;
      }
  
      .btn-submit {
        padding: 14px 20px;
        font-size: 0.95rem;
      }
  
      .user-type-label {
        font-size: 0.9rem;
      }
    }
  </style>