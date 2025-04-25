<script lang="ts">
    import { supabase } from '../../components/supabase';
    import { goto } from '$app/navigation';
    
    type ConductorData = {
      id?: string;
      user_id: string;
      nombre: string;
      placa: string;
      licencia: string;
      propiedad: string;
      control: string;
      marca: string;
      email: string;
      telefono: string;
      acepta_terminos: boolean;
      created_at?: string;
    };
  
    let nombre = '';
    let password = '';
    let placa = '';
    let licencia = '';
    let propiedad = '';
    let control = '';
    let email = '';
    let telefono = '';
    let marca = '';
    let aceptaTerminos = false;
    let showPassword = false;
    let errorMessage = '';
    let isLoading = false;
    
    function togglePassword() {
      showPassword = !showPassword;
    }

    async function handleSubmit() {
      // Validaciones iniciales
      if (!aceptaTerminos) {
        errorMessage = 'Debes aceptar los términos y condiciones';
        return;
      }
  
      if (password.length < 8) {
        errorMessage = 'La contraseña debe tener al menos 8 caracteres';
        return;
      }

      // Asegurar que los valores son cadenas antes de usar trim()
      const emailTrimmed = email?.toString().trim() || '';
      const passwordTrimmed = password?.toString().trim() || '';
      const nombreTrimmed = nombre?.toString().trim() || '';
      const placaTrimmed = placa?.toString().trim().toUpperCase() || '';
      const licenciaTrimmed = licencia?.toString().trim() || '';
      const propiedadTrimmed = propiedad?.toString().trim() || '';
      const controlTrimmed = control?.toString().trim() || '';
      const marcaTrimmed = marca?.toString().trim() || '';
      const telefonoTrimmed = telefono?.toString().trim() || '';

      isLoading = true;
      errorMessage = '';
      
      try {
        // 1️⃣ **Registrar al usuario en Supabase Auth**
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: emailTrimmed,
          password: passwordTrimmed
        });

        if (authError) throw new Error(authError.message);
        const userId = authData?.user?.id;

        // 2️⃣ **Llamar a la función `create_conductor` después del registro exitoso**
        const { data: transactionData, error: transactionError } = await supabase.rpc('create_conductor', {
          p_nombre: nombreTrimmed,
          p_placa: placaTrimmed,
          p_licencia: licenciaTrimmed,
          p_propiedad: propiedadTrimmed,
          p_control: controlTrimmed,
          p_marca: marcaTrimmed,
          p_email: emailTrimmed,
          p_telefono: telefonoTrimmed,
          p_acepta_terminos: aceptaTerminos
        });

        if (transactionError) throw transactionError;

        // 3️⃣ **Si todo salió bien, redirigir**
        goto('/auth');
  
      } catch (error: unknown) {
        // Manejo seguro del error
        if (error instanceof Error) {
          errorMessage = error.message;
          
          if (error.message.includes('User already registered') || error.message.includes('email ya está registrado')) {
            errorMessage = 'Este email ya está registrado';
          } else if (error.message.includes('password')) {
            errorMessage = 'La contraseña no cumple los requisitos';
          }
        } else {
          errorMessage = 'Ocurrió un error inesperado';
        }
        
        console.error('Error en registro:', error);
      } finally {
        isLoading = false;
      }
    }
</script>



  <div class="wrapper">
	<div class="scroll-container">
	  <div class="container animate-fall">
		<div class="container text-center p-5 rounded">
		  <h1 class="title">Registro de Conductores</h1>
		  <p class="subtitle">Completa tus datos para comenzar</p>
  
		  {#if errorMessage}
			<div class="alert alert-danger mb-4">
			  {errorMessage}
			</div>
		  {/if}
  
		  <form on:submit|preventDefault={handleSubmit} class="driver-form">
			<!-- Campos del formulario -->
			<div class="form-group">
			  <label for="nombre">Nombre completo</label>
			  <input
				id="nombre"
				type="text"
				bind:value={nombre}
				placeholder="Ej: Juan Pérez"
				required
			  />
			  <div class="underline"></div>
			</div>
  
			<div class="form-group">
			  <label for="control">Número de control</label>
			  <input
				id="control"
				type="number"
				bind:value={control}
				placeholder="Ej: 12345"
				required
			  />
			  <div class="underline"></div>
			</div>

			<div class="form-group">
			  <label for="control">Telefono</label>
			  <input
				id="telefono"
				type="number"
				bind:value={telefono}
				placeholder="Ej: 12345"
				required
			  />
			  <div class="underline"></div>
			</div>
  
			<div class="form-group">
			  <label for="marca">Marca y modelo</label>
			  <input
				id="marca"
				type="text"
				bind:value={marca}
				placeholder="Ej: Toyota Corolla 2020"
				required
			  />
			  <div class="underline"></div>
			</div>
  
			<div class="form-group">
			  <label for="propiedad">Tipo de conductor</label>
			  <select id="propiedad" class="text-dark" bind:value={propiedad} required>
				<option value="" disabled selected>Selecciona</option>
				<option value="socio">Socio</option>
				<option value="avance">Avance</option>
			  </select>
			  <div class="underline"></div>
			</div>
  
			<div class="form-group">
			  <label for="placa">Placa del vehículo</label>
			  <input id="placa" type="text" bind:value={placa} placeholder="Ej: ABC-123" required />
			  <div class="underline"></div>
			</div>
  
			<div class="form-group">
			  <label for="licencia">Número de licencia</label>
			  <input
				id="licencia"
				type="text"
				bind:value={licencia}
				placeholder="Ej: 123456789"
				required
			  />
			  <div class="underline"></div>
			</div>
  
			<div class="form-group">
			  <label for="email">Correo electrónico</label>
			  <input
				id="email"
				type="email"
				bind:value={email}
				placeholder="Ej: ejemplo@gmail.com"
				required
			  />
			  <div class="underline"></div>
			</div>
  
			<div class="form-group">
			  <label for="password">Contraseña</label>
			  <div class="password-input">
				<input
				  id="password"
				  type={showPassword ? 'text' : 'password'}
				  bind:value={password}
				  placeholder="Mínimo 8 caracteres"
				  minlength="8"
				  required
				/>
				<button type="button" class="toggle-password" on:click={togglePassword}>
				  {showPassword ? '🙈' : '👁️'}
				</button>
			  </div>
			  <div class="underline"></div>
			</div>
  
			<div class="form-check">
			  <input id="terminos" type="checkbox" bind:checked={aceptaTerminos} required />
			  <label for="terminos">Acepto los términos y condiciones</label>
			</div>
  
			<button type="submit" class="btn-submit" disabled={!aceptaTerminos || isLoading}>
			  {#if isLoading}
				<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
				Procesando...
			  {:else}
				<span class="btn-icon">🚗</span>
				<span>Registrarme como conductor</span>
			  {/if}
			</button>
		  </form>
  
		  <!-- Elementos decorativos -->
		  <div class="floating-elements">
			<div class="circle circle-1"></div>
			<div class="circle circle-2"></div>
			<div class="circle circle-3"></div>
		  </div>
		</div>
	  </div>
	</div>
  </div>

  <style>
	:global(body) {
	  margin: 0;
	  padding: 0;
	  font-family: 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
	  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
	  min-height: 100vh;
	}
  
	.wrapper {
	  display: flex;
	  justify-content: center;
	  align-items: center;
	  min-height: 100vh;
	  padding: 20px;
	}
  
	.scroll-container {
	  width: 100%;
	  max-width: 800px;
	  perspective: 1000px;
	}
  
	.container {
	  background: white;
	  border-radius: 15px;
	  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
	  overflow: hidden;
	  transition: transform 0.5s ease;
	  position: relative;
	  z-index: 1;
	}
  
	.container:hover {
	  transform: translateY(-5px);
	}
  
	.container.text-center {
	  padding: 40px;
	}
  
	.title {
	  color: #2c3e50;
	  font-size: 2.2rem;
	  margin-bottom: 10px;
	  font-weight: 700;
	  position: relative;
	  display: inline-block;
	}
  
	.title::after {
	  content: '';
	  position: absolute;
	  bottom: -8px;
	  left: 50%;
	  transform: translateX(-50%);
	  width: 60px;
	  height: 3px;
	  background: #3498db;
	  border-radius: 3px;
	}
  
	.subtitle {
	  color: #7f8c8d;
	  font-size: 1.1rem;
	  margin-bottom: 30px;
	}
  
	.driver-form {
	  display: grid;
	  grid-template-columns: 1fr 1fr;
	  gap: 20px;
	}
  
	.form-group {
	  position: relative;
	  margin-bottom: 25px;
	}
  
	.form-group label {
	  display: block;
	  margin-bottom: 8px;
	  color: #34495e;
	  font-weight: 500;
	  font-size: 0.95rem;
	}
  
	.form-group input,
	.form-group select {
	  width: 100%;
	  padding: 12px 0;
	  border: none;
	  border-bottom: 2px solid #ecf0f1;
	  background: transparent;
	  font-size: 1rem;
	  color: #2c3e50;
	  transition: all 0.3s ease;
	}
  
	.form-group input:focus,
	.form-group select:focus {
	  outline: none;
	  border-bottom-color: #3498db;
	}
  
	.form-group input::placeholder {
	  color: #bdc3c7;
	}
  
	.underline {
	  position: absolute;
	  bottom: 0;
	  left: 0;
	  width: 0;
	  height: 2px;
	  background: #3498db;
	  transition: width 0.3s ease;
	}
  
	.form-group input:focus ~ .underline,
	.form-group select:focus ~ .underline {
	  width: 100%;
	}
  
	.password-input {
	  position: relative;
	}
  
	.toggle-password {
	  position: absolute;
	  right: 0;
	  top: 50%;
	  transform: translateY(-50%);
	  background: none;
	  border: none;
	  cursor: pointer;
	  font-size: 1.2rem;
	  color: #7f8c8d;
	  padding: 5px;
	}
  
	.form-check {
	  grid-column: span 2;
	  display: flex;
	  align-items: center;
	  margin: 15px 0;
	}
  
	.form-check input {
	  margin-right: 10px;
	  width: auto;
	}
  
	.form-check label {
	  color: #7f8c8d;
	  font-size: 0.9rem;
	}
  
	.btn-submit {
	  grid-column: span 2;
	  background: linear-gradient(to right, #3498db, #2980b9);
	  color: white;
	  border: none;
	  padding: 15px;
	  border-radius: 50px;
	  font-size: 1.1rem;
	  font-weight: 600;
	  cursor: pointer;
	  transition: all 0.3s ease;
	  display: flex;
	  align-items: center;
	  justify-content: center;
	  box-shadow: 0 4px 15px rgba(52, 152, 219, 0.3);
	}
  
	.btn-submit:hover {
	  transform: translateY(-2px);
	  box-shadow: 0 6px 20px rgba(52, 152, 219, 0.4);
	}
  
	.btn-submit:disabled {
	  background: #bdc3c7;
	  cursor: not-allowed;
	  transform: none;
	  box-shadow: none;
	}
  
	.btn-icon {
	  margin-right: 10px;
	  font-size: 1.2rem;
	}
  
	.alert {
	  padding: 15px;
	  border-radius: 8px;
	  margin-bottom: 25px;
	  background: #e74c3c;
	  color: white;
	  font-weight: 500;
	  text-align: center;
	  animation: fadeIn 0.3s ease;
	}
  
	.floating-elements {
	  position: absolute;
	  top: 0;
	  left: 0;
	  width: 100%;
	  height: 100%;
	  overflow: hidden;
	  z-index: -1;
	}
  
	.circle {
	  position: absolute;
	  border-radius: 50%;
	  background: rgba(52, 152, 219, 0.1);
	  animation: float 15s infinite linear;
	}
  
	.circle-1 {
	  width: 150px;
	  height: 150px;
	  top: -50px;
	  left: -50px;
	}
  
	.circle-2 {
	  width: 250px;
	  height: 250px;
	  bottom: -100px;
	  right: -100px;
	  animation-delay: 3s;
	}
  
	.circle-3 {
	  width: 100px;
	  height: 100px;
	  top: 30%;
	  right: 20%;
	  animation-delay: 6s;
	}
  
	@keyframes float {
	  0% {
		transform: translateY(0) rotate(0deg);
	  }
	  50% {
		transform: translateY(-20px) rotate(180deg);
	  }
	  100% {
		transform: translateY(0) rotate(360deg);
	  }
	}
  
	@keyframes fadeIn {
	  from {
		opacity: 0;
		transform: translateY(-10px);
	  }
	  to {
		opacity: 1;
		transform: translateY(0);
	  }
	}
  
	/* Responsive */
	@media (max-width: 768px) {
	  .driver-form {
		grid-template-columns: 1fr;
	  }
	  
	  .form-check,
	  .btn-submit {
		grid-column: span 1;
	  }
	  
	  .container.text-center {
		padding: 30px 20px;
	  }
	  
	  .title {
		font-size: 1.8rem;
	  }
	  
	  .subtitle {
		font-size: 1rem;
	  }
	}
  
	@media (max-width: 480px) {
	  .wrapper {
		padding: 10px;
	  }
	  
	  .container.text-center {
		padding: 25px 15px;
	  }
	  
	  .title {
		font-size: 1.5rem;
	  }
	}
  </style>
