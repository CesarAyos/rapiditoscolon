<body>
<div class="wrapper">
    <div class="container text-center rounded text-center text-uppercase fs-4 fw-bold">
      <h1 class="title">¡Bienvenido a Rapiditos Colón!</h1>
      <!-- <p class="subtitle">Selecciona una opción</p> -->
      
      <div class="btn-container mt-4">
        <a href="/auth" class="btn btn-driver" aria-current="page">
          <span class="btn-icon">🚗</span>
          <span>Soy conductor</span>
        </a>
      </div>
      
      <div class="floating-elements">
        <div class="circle circle-1"></div>
        <div class="circle circle-2"></div>
        <div class="circle circle-3"></div>
      </div>
    </div>
  </div>
  
</body>
  
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700&display=swap');
    
    body {
      font-family: 'Poppins', sans-serif;
      background: linear-gradient(135deg, #f3f4f6, #0f0f0f);
      height: 100vh;
      overflow: hidden;
      margin: 0;
      padding: 0;
    }
    
    .wrapper {
      position: relative;
      height: 100%;
      width: 100%;
    }
    
    .container {
      background: rgba(255, 255, 255, 0.2);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.3);
      width: 80%;
      max-width: 600px;
      margin: 0 auto;
      position: relative;
      top: 50%;
      transform: translateY(-50%);
      padding: 2.5rem !important;
      border-radius: 20px !important;
      box-shadow: 0 15px 35px rgba(0, 0, 0, 0.2), 
                  0 5px 15px rgba(0, 0, 0, 0.1) !important;
      transition: all 0.5s ease;
      animation: fadeInUp 1s ease-out both;
      z-index: 10;
    }
    
    .container:hover {
      transform: translateY(-50%) scale(1.02);
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3), 
                  0 10px 20px rgba(0, 0, 0, 0.2) !important;
    }
    
    .title {
      font-size: 2.5rem;
      font-weight: 700;
      color: #fff;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      margin-bottom: 1.5rem;
      position: relative;
      display: inline-block;
      animation: textGlow 2s infinite alternate;
    }

    
    
    .title::after {
      content: '';
      position: absolute;
      bottom: -10px;
      left: 50%;
      transform: translateX(-50%);
      width: 50px;
      height: 3px;
      background: #fff;
      border-radius: 3px;
    }
    
    .subtitle {
      font-size: 1.2rem;
      color: rgba(255, 255, 255, 0.9);
      margin-bottom: 2rem;
      font-weight: 300;
    }
    
    .btn-container {
      display: flex;
      justify-content: center;
      gap: 20px;
      flex-wrap: wrap;
    }
    
    .btn {
      padding: 12px 25px;
      border-radius: 50px !important;
      font-weight: 600 !important;
      text-transform: uppercase;
      letter-spacing: 1px;
      transition: all 0.4s ease;
      display: flex;
      align-items: center;
      gap: 10px;
      position: relative;
      overflow: hidden;
      border: none !important;
    }
    
    .btn::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
      transition: all 0.6s ease;
    }
    
    .btn:hover::before {
      left: 100%;
    }
    
    .btn-driver {
      background: rgba(255, 255, 255, 0.1) !important;
      color: #fff !important;
      box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
    }
    
    .btn-driver:hover {
      background: rgba(255, 255, 255, 0.2) !important;
      transform: translateY(-3px);
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
    }
    
    .btn-passenger {
      background: rgba(0, 0, 0, 0.1) !important;
      color: #fff !important;
      box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
    }
    
    .btn-passenger:hover {
      background: rgba(0, 0, 0, 0.2) !important;
      transform: translateY(-3px);
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
    }
    
    .btn-icon {
      font-size: 1.2rem;
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
      background: rgba(255, 255, 255, 0.1);
      animation: float 15s infinite linear;
    }
    
    .circle-1 {
      width: 100px;
      height: 100px;
      top: 10%;
      left: 10%;
      animation-delay: 0s;
    }
    
    .circle-2 {
      width: 150px;
      height: 150px;
      top: 60%;
      left: 70%;
      animation-delay: 2s;
      animation-duration: 20s;
    }
    
    .circle-3 {
      width: 70px;
      height: 70px;
      top: 80%;
      left: 20%;
      animation-delay: 4s;
      animation-duration: 25s;
    }
    
    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(50px) translateY(-50%);
      }
      to {
        opacity: 1;
        transform: translateY(0) translateY(-50%);
      }
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
    
    @keyframes textGlow {
      from {
        text-shadow: 0 0 5px rgba(255, 255, 255, 0.5);
      }
      to {
        text-shadow: 0 0 15px rgba(255, 255, 255, 0.8), 
                     0 0 20px rgba(255, 255, 255, 0.6);
      }
    }
    
    @media (max-width: 768px) {
      .container {
        width: 90%;
        padding: 1.5rem !important;
      }
      
      .title {
        font-size: 2rem;
      }
      
      .btn-container {
        flex-direction: column;
        gap: 15px;
      }
      
      .btn {
        width: 100%;
        justify-content: center;
      }
    }
  </style>