
<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>International Sports Solutions - Premier Sports Academy Management</title>
    <meta name="description" content="Transform your sports academy with our comprehensive management platform. Streamline operations, track performance, and grow your sports business.">
    
    <!-- Fonts -->
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
    
    <!-- Styles -->
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Inter', sans-serif;
            line-height: 1.6;
            color: #333;
            overflow-x: hidden;
        }
        
        /* Header */
        .header {
            position: fixed;
            top: 0;
            width: 100%;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            z-index: 1000;
            transition: all 0.3s ease;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .nav {
            max-width: 1200px;
            margin: 0 auto;
            padding: 1rem 2rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .logo {
            font-size: 1.5rem;
            font-weight: 800;
            color: #e53e3e;
            text-decoration: none;
        }
        
        .nav-links {
            display: flex;
            list-style: none;
            gap: 2rem;
            align-items: center;
        }
        
        .nav-link {
            text-decoration: none;
            color: #333;
            font-weight: 500;
            transition: color 0.3s ease;
        }
        
        .nav-link:hover {
            color: #e53e3e;
        }
        
        .cta-btn {
            background: linear-gradient(135deg, #e53e3e, #ff6b6b);
            color: white;
            padding: 0.75rem 1.5rem;
            border-radius: 50px;
            text-decoration: none;
            font-weight: 600;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(229, 62, 62, 0.3);
        }
        
        .cta-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(229, 62, 62, 0.4);
        }
        
        /* Hero Section */
        .hero {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            position: relative;
            overflow: hidden;
        }
        
        .hero::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: url('https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2070&q=80') center/cover;
            opacity: 0.3;
        }
        
        .hero-content {
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
            text-align: center;
            position: relative;
            z-index: 2;
            color: white;
        }
        
        .hero h1 {
            font-size: 3.5rem;
            font-weight: 800;
            margin-bottom: 1rem;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        
        .hero p {
            font-size: 1.25rem;
            margin-bottom: 2rem;
            opacity: 0.9;
            max-width: 600px;
            margin-left: auto;
            margin-right: auto;
        }
        
        .hero-buttons {
            display: flex;
            gap: 1rem;
            justify-content: center;
            flex-wrap: wrap;
        }
        
        .btn-primary {
            background: linear-gradient(135deg, #e53e3e, #ff6b6b);
            color: white;
            padding: 1rem 2rem;
            border-radius: 50px;
            text-decoration: none;
            font-weight: 600;
            transition: all 0.3s ease;
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            box-shadow: 0 8px 25px rgba(229, 62, 62, 0.3);
        }
        
        .btn-secondary {
            background: rgba(255, 255, 255, 0.2);
            color: white;
            padding: 1rem 2rem;
            border-radius: 50px;
            text-decoration: none;
            font-weight: 600;
            transition: all 0.3s ease;
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.3);
        }
        
        .btn-primary:hover, .btn-secondary:hover {
            transform: translateY(-3px);
            box-shadow: 0 12px 35px rgba(0, 0, 0, 0.2);
        }
        
        /* Features Section */
        .features {
            padding: 5rem 2rem;
            background: #f8fafc;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        
        .section-title {
            text-align: center;
            margin-bottom: 3rem;
        }
        
        .section-title h2 {
            font-size: 2.5rem;
            font-weight: 700;
            color: #2d3748;
            margin-bottom: 1rem;
        }
        
        .section-title p {
            font-size: 1.1rem;
            color: #718096;
            max-width: 600px;
            margin: 0 auto;
        }
        
        .features-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 2rem;
            margin-top: 3rem;
        }
        
        .feature-card {
            background: white;
            padding: 2rem;
            border-radius: 1rem;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
            transition: all 0.3s ease;
            text-align: center;
        }
        
        .feature-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
        }
        
        .feature-icon {
            width: 80px;
            height: 80px;
            background: linear-gradient(135deg, #e53e3e, #ff6b6b);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 1.5rem;
            font-size: 2rem;
            color: white;
        }
        
        .feature-card h3 {
            font-size: 1.5rem;
            font-weight: 600;
            margin-bottom: 1rem;
            color: #2d3748;
        }
        
        .feature-card p {
            color: #718096;
            line-height: 1.6;
        }
        
        /* Sports Section */
        .sports {
            padding: 5rem 2rem;
            background: white;
        }
        
        .sports-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 2rem;
            margin-top: 3rem;
        }
        
        .sport-card {
            position: relative;
            height: 300px;
            border-radius: 1rem;
            overflow: hidden;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        
        .sport-card:hover {
            transform: scale(1.05);
        }
        
        .sport-card img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        
        .sport-overlay {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            background: linear-gradient(transparent, rgba(0,0,0,0.8));
            color: white;
            padding: 2rem;
            transform: translateY(50%);
            transition: all 0.3s ease;
        }
        
        .sport-card:hover .sport-overlay {
            transform: translateY(0);
        }
        
        .sport-overlay h3 {
            font-size: 1.5rem;
            font-weight: 600;
            margin-bottom: 0.5rem;
        }
        
        /* Access Panels */
        .access-panels {
            padding: 5rem 2rem;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        
        .panels-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 3rem;
            margin-top: 3rem;
            max-width: 800px;
            margin-left: auto;
            margin-right: auto;
        }
        
        .panel-card {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            padding: 2rem;
            border-radius: 1rem;
            text-align: center;
            transition: all 0.3s ease;
        }
        
        .panel-card:hover {
            transform: translateY(-5px);
            background: rgba(255, 255, 255, 0.15);
        }
        
        .panel-icon {
            width: 80px;
            height: 80px;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 1.5rem;
            font-size: 2rem;
        }
        
        .panel-card h3 {
            font-size: 1.5rem;
            font-weight: 600;
            margin-bottom: 1rem;
        }
        
        .panel-card p {
            margin-bottom: 1.5rem;
            opacity: 0.9;
        }
        
        .panel-btn {
            background: white;
            color: #667eea;
            padding: 0.75rem 1.5rem;
            border-radius: 50px;
            text-decoration: none;
            font-weight: 600;
            transition: all 0.3s ease;
            display: inline-block;
        }
        
        .panel-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
        }
        
        /* Pricing Section */
        .pricing {
            padding: 5rem 2rem;
            background: #f7fafc;
        }
        
        .duration-toggle {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 1rem;
            margin: 2rem 0 3rem;
        }
        
        .duration-label {
            font-weight: 600;
            color: #4a5568;
        }
        
        .save-badge {
            background: linear-gradient(135deg, #e53e3e, #ff6b6b);
            color: white;
            padding: 0.25rem 0.5rem;
            border-radius: 1rem;
            font-size: 0.75rem;
            font-weight: 600;
            margin-left: 0.5rem;
        }
        
        .toggle-switch {
            position: relative;
            display: inline-block;
            width: 60px;
            height: 30px;
        }
        
        .toggle-switch input {
            opacity: 0;
            width: 0;
            height: 0;
        }
        
        .slider {
            position: absolute;
            cursor: pointer;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: #cbd5e0;
            transition: 0.4s;
            border-radius: 30px;
        }
        
        .slider:before {
            position: absolute;
            content: "";
            height: 22px;
            width: 22px;
            left: 4px;
            bottom: 4px;
            background-color: white;
            transition: 0.4s;
            border-radius: 50%;
        }
        
        input:checked + .slider {
            background: linear-gradient(135deg, #e53e3e, #ff6b6b);
        }
        
        input:checked + .slider:before {
            transform: translateX(30px);
        }
        
        .pricing-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
            gap: 2rem;
            margin-top: 3rem;
        }
        
        .pricing-card {
            background: white;
            border-radius: 1rem;
            padding: 2rem;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
            transition: all 0.3s ease;
            position: relative;
            border: 2px solid transparent;
        }
        
        .pricing-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
        }
        
        .pricing-card.featured {
            border-color: #e53e3e;
            transform: scale(1.05);
        }
        
        .pricing-card.featured:hover {
            transform: scale(1.05) translateY(-5px);
        }
        
        .popular-badge {
            position: absolute;
            top: -12px;
            left: 50%;
            transform: translateX(-50%);
            background: linear-gradient(135deg, #e53e3e, #ff6b6b);
            color: white;
            padding: 0.5rem 1.5rem;
            border-radius: 50px;
            font-size: 0.875rem;
            font-weight: 600;
        }
        
        .plan-header h3 {
            font-size: 1.5rem;
            font-weight: 700;
            color: #2d3748;
            margin-bottom: 0.5rem;
        }
        
        .plan-header p {
            color: #718096;
            margin-bottom: 1.5rem;
        }
        
        .plan-price {
            text-align: center;
            margin-bottom: 2rem;
        }
        
        .currency {
            font-size: 1.25rem;
            color: #718096;
            vertical-align: top;
        }
        
        .amount {
            font-size: 3rem;
            font-weight: 800;
            color: #2d3748;
        }
        
        .period {
            color: #718096;
            font-size: 1rem;
        }
        
        .feature-limits {
            background: #f7fafc;
            border-radius: 0.5rem;
            padding: 1rem;
            margin-bottom: 1.5rem;
        }
        
        .limit-item {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            margin-bottom: 0.5rem;
            font-weight: 600;
            color: #4a5568;
        }
        
        .limit-item:last-child {
            margin-bottom: 0;
        }
        
        .limit-item i {
            color: #e53e3e;
            width: 16px;
        }
        
        .feature-list {
            list-style: none;
            margin-bottom: 2rem;
        }
        
        .feature-list li {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            margin-bottom: 0.75rem;
            color: #4a5568;
        }
        
        .feature-list .fas.fa-check {
            color: #48bb78;
        }
        
        .feature-list .fas.fa-times {
            color: #e53e3e;
        }
        
        .plan-button {
            width: 100%;
            padding: 1rem;
            background: #e2e8f0;
            color: #4a5568;
            text-align: center;
            text-decoration: none;
            border-radius: 0.5rem;
            font-weight: 600;
            transition: all 0.3s ease;
            display: block;
        }
        
        .plan-button:hover {
            background: #cbd5e0;
            transform: translateY(-2px);
        }
        
        .featured-button {
            background: linear-gradient(135deg, #e53e3e, #ff6b6b);
            color: white;
        }
        
        .featured-button:hover {
            background: linear-gradient(135deg, #c53030, #e53e3e);
        }
        
        .pricing-footer {
            margin-top: 4rem;
            display: grid;
            grid-template-columns: 2fr 1fr;
            gap: 3rem;
            align-items: center;
        }
        
        .pricing-notes h4 {
            color: #2d3748;
            margin-bottom: 1rem;
            font-size: 1.25rem;
        }
        
        .included-features {
            display: flex;
            flex-wrap: wrap;
            gap: 1rem;
        }
        
        .included-features span {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            color: #4a5568;
            font-weight: 500;
        }
        
        .included-features i {
            color: #48bb78;
        }
        
        .money-back {
            display: flex;
            align-items: center;
            gap: 1rem;
            background: white;
            padding: 1.5rem;
            border-radius: 1rem;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
        }
        
        .money-back i {
            font-size: 2rem;
            color: #48bb78;
        }
        
        .money-back strong {
            color: #2d3748;
            display: block;
            margin-bottom: 0.25rem;
        }
        
        .money-back p {
            color: #718096;
            margin: 0;
            font-size: 0.875rem;
        }
        
        /* Footer */
        .footer {
            background: #1a202c;
            color: white;
            padding: 3rem 2rem 1rem;
        }
        
        .footer-content {
            max-width: 1200px;
            margin: 0 auto;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 2rem;
        }
        
        .footer-section h3 {
            font-size: 1.25rem;
            font-weight: 600;
            margin-bottom: 1rem;
            color: #e53e3e;
        }
        
        .footer-section p, .footer-section li {
            color: #a0aec0;
            margin-bottom: 0.5rem;
        }
        
        .footer-section ul {
            list-style: none;
        }
        
        .footer-section a {
            color: #a0aec0;
            text-decoration: none;
            transition: color 0.3s ease;
        }
        
        .footer-section a:hover {
            color: white;
        }
        
        .footer-bottom {
            margin-top: 2rem;
            padding-top: 2rem;
            border-top: 1px solid #2d3748;
            text-align: center;
            color: #a0aec0;
        }
        
        /* Responsive */
        @media (max-width: 768px) {
            .nav-links {
                display: none;
            }
            
            .hero h1 {
                font-size: 2.5rem;
            }
            
            .hero-buttons {
                flex-direction: column;
                align-items: center;
            }
            
            .section-title h2 {
                font-size: 2rem;
            }
            
            .pricing-grid {
                grid-template-columns: 1fr;
            }
            
            .pricing-card.featured {
                transform: none;
            }
            
            .pricing-card.featured:hover {
                transform: translateY(-5px);
            }
            
            .pricing-footer {
                grid-template-columns: 1fr;
                gap: 2rem;
            }
            
            .included-features {
                justify-content: center;
            }
        }
        
        /* Animations */
        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        .fade-in-up {
            animation: fadeInUp 0.8s ease forwards;
        }
        
        /* Loading Animation */
        .loading {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 2px solid rgba(255,255,255,.3);
            border-radius: 50%;
            border-top-color: #fff;
            animation: spin 1s ease-in-out infinite;
        }
        
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <!-- Header -->
    <header class="header">
        <nav class="nav">
            <a href="#" class="logo">
                <i class="fas fa-trophy"></i> International Sports Solutions
            </a>
            <ul class="nav-links">
                <li><a href="#home" class="nav-link">Home</a></li>
                <li><a href="#features" class="nav-link">Features</a></li>
                <li><a href="#sports" class="nav-link">Sports</a></li>
                <li><a href="#pricing" class="nav-link">Pricing</a></li>
                <li><a href="#access" class="nav-link">Access</a></li>
                <li><a href="#contact" class="nav-link">Contact</a></li>
                <li><a href="#access" class="cta-btn">Get Started</a></li>
            </ul>
        </nav>
    </header>

    <!-- Hero Section -->
    <section id="home" class="hero">
        <div class="hero-content fade-in-up">
            <h1>Transform Your Sports Academy</h1>
            <p>The complete management platform for sports academies, martial arts schools, and fitness centers. Streamline operations, track student progress, and grow your business.</p>
            <div class="hero-buttons">
                <a href="#access" class="btn-primary">
                    <i class="fas fa-rocket"></i> Start Free Trial
                </a>
                <a href="#features" class="btn-secondary">
                    <i class="fas fa-play"></i> Watch Demo
                </a>
            </div>
        </div>
    </section>

    <!-- Features Section -->
    <section id="features" class="features">
        <div class="container">
            <div class="section-title">
                <h2>Everything You Need to Succeed</h2>
                <p>Comprehensive tools designed specifically for sports academies and martial arts schools</p>
            </div>
            
            <div class="features-grid">
                <div class="feature-card fade-in-up">
                    <div class="feature-icon">
                        <i class="fas fa-users"></i>
                    </div>
                    <h3>Student Management</h3>
                    <p>Complete student profiles, enrollment tracking, belt progression, and performance analytics. Keep detailed records of every student's journey.</p>
                </div>
                
                <div class="feature-card fade-in-up">
                    <div class="feature-icon">
                        <i class="fas fa-calendar-alt"></i>
                    </div>
                    <h3>Class Scheduling</h3>
                    <p>Flexible class scheduling, batch management, coach assignment, and automated attendance tracking. Never miss a class again.</p>
                </div>
                
                <div class="feature-card fade-in-up">
                    <div class="feature-icon">
                        <i class="fas fa-dollar-sign"></i>
                    </div>
                    <h3>Fee Management</h3>
                    <p>Automated billing, payment tracking, late fee management, and financial reporting. Streamline your revenue operations.</p>
                </div>
                
                <div class="feature-card fade-in-up">
                    <div class="feature-icon">
                        <i class="fas fa-chart-line"></i>
                    </div>
                    <h3>Performance Analytics</h3>
                    <p>Track student progress, technique mastery, attendance patterns, and academy performance with detailed analytics and reports.</p>
                </div>
                
                <div class="feature-card fade-in-up">
                    <div class="feature-icon">
                        <i class="fas fa-trophy"></i>
                    </div>
                    <h3>Event Management</h3>
                    <p>Organize tournaments, competitions, grading events, and seminars. Manage registrations and track participation effortlessly.</p>
                </div>
                
                <div class="feature-card fade-in-up">
                    <div class="feature-icon">
                        <i class="fas fa-mobile-alt"></i>
                    </div>
                    <h3>Mobile Ready</h3>
                    <p>Access your academy management system from anywhere. Responsive design works perfectly on all devices and platforms.</p>
                </div>
            </div>
        </div>
    </section>

    <!-- Sports Section -->
    <section id="sports" class="sports">
        <div class="container">
            <div class="section-title">
                <h2>Perfect for All Sports</h2>
                <p>Our platform adapts to any sport or martial art discipline</p>
            </div>
            
            <div class="sports-grid">
                <div class="sport-card">
                    <img src="https://images.unsplash.com/photo-1555597673-b21d5c935865?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=500&q=80" alt="Karate">
                    <div class="sport-overlay">
                        <h3>Karate</h3>
                        <p>Traditional martial arts with belt progression tracking</p>
                    </div>
                </div>
                
                <div class="sport-card">
                    <img src="https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=500&q=80" alt="Boxing">
                    <div class="sport-overlay">
                        <h3>Boxing</h3>
                        <p>Combat sports training and competition management</p>
                    </div>
                </div>
                
                <div class="sport-card">
                    <img src="https://images.unsplash.com/photo-1574629810360-7efbbe195018?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=500&q=80" alt="Football">
                    <div class="sport-overlay">
                        <h3>Football</h3>
                        <p>Team sports with player development tracking</p>
                    </div>
                </div>
                
                <div class="sport-card">
                    <img src="https://images.unsplash.com/photo-1546519638-68e109498ffc?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=500&q=80" alt="Basketball">
                    <div class="sport-overlay">
                        <h3>Basketball</h3>
                        <p>Court sports with skill development programs</p>
                    </div>
                </div>
                
                <div class="sport-card">
                    <img src="https://images.unsplash.com/photo-1506629905607-61173b27958f?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=500&q=80" alt="Yoga">
                    <div class="sport-overlay">
                        <h3>Yoga & Fitness</h3>
                        <p>Wellness programs and fitness class management</p>
                    </div>
                </div>
                
                <div class="sport-card">
                    <img src="https://images.unsplash.com/photo-1530549387789-4c1017266635?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=500&q=80" alt="Swimming">
                    <div class="sport-overlay">
                        <h3>Swimming</h3>
                        <p>Aquatic sports with stroke technique tracking</p>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Pricing Section -->
    <section id="pricing" class="pricing">
        <div class="container">
            <div class="section-title">
                <h2>Choose Your Perfect Plan</h2>
                <p>Flexible pricing options designed to grow with your sports academy</p>
            </div>
            
            <!-- Duration Toggle -->
            <div class="duration-toggle">
                <span class="duration-label">Monthly</span>
                <label class="toggle-switch">
                    <input type="checkbox" id="durationToggle">
                    <span class="slider"></span>
                </label>
                <span class="duration-label">Yearly <span class="save-badge">Save 20%</span></span>
            </div>
            
            <div class="pricing-grid">
                <!-- Starter Plan -->
                <div class="pricing-card">
                    <div class="plan-header">
                        <h3>Starter</h3>
                        <p>Perfect for small academies</p>
                    </div>
                    <div class="plan-price">
                        <span class="currency">₹</span>
                        <span class="amount monthly-price">2,999</span>
                        <span class="amount yearly-price" style="display: none;">2,399</span>
                        <span class="period">/month</span>
                    </div>
                    <div class="plan-features">
                        <div class="feature-limits">
                            <div class="limit-item">
                                <i class="fas fa-building"></i>
                                <span>1 Branch</span>
                            </div>
                            <div class="limit-item">
                                <i class="fas fa-user-tie"></i>
                                <span>Up to 5 Coaches</span>
                            </div>
                            <div class="limit-item">
                                <i class="fas fa-users"></i>
                                <span>Up to 100 Students</span>
                            </div>
                        </div>
                        <ul class="feature-list">
                            <li><i class="fas fa-check"></i> Student Management</li>
                            <li><i class="fas fa-check"></i> Branch Management</li>
                            <li><i class="fas fa-check"></i> Batch & Class Scheduling</li>
                            <li><i class="fas fa-check"></i> Attendance Tracking</li>
                            <li><i class="fas fa-check"></i> Fee Collection & Management</li>
                            <li><i class="fas fa-check"></i> Academy Panel Access</li>
                            <li><i class="fas fa-check"></i> Student Panel Access</li>
                            <li><i class="fas fa-times"></i> Event Management</li>
                            <li><i class="fas fa-times"></i> User & Role Management</li>
                            <li><i class="fas fa-times"></i> Syllabus Management</li>
                        </ul>
                    </div>
                    <a href="#" class="plan-button">Start Free Trial</a>
                </div>

                <!-- Professional Plan -->
                <div class="pricing-card featured">
                    <div class="popular-badge">Most Popular</div>
                    <div class="plan-header">
                        <h3>Professional</h3>
                        <p>Ideal for growing academies</p>
                    </div>
                    <div class="plan-price">
                        <span class="currency">₹</span>
                        <span class="amount monthly-price">5,999</span>
                        <span class="amount yearly-price" style="display: none;">4,799</span>
                        <span class="period">/month</span>
                    </div>
                    <div class="plan-features">
                        <div class="feature-limits">
                            <div class="limit-item">
                                <i class="fas fa-building"></i>
                                <span>3 Branches</span>
                            </div>
                            <div class="limit-item">
                                <i class="fas fa-user-tie"></i>
                                <span>Up to 15 Coaches</span>
                            </div>
                            <div class="limit-item">
                                <i class="fas fa-users"></i>
                                <span>Up to 300 Students</span>
                            </div>
                        </div>
                        <ul class="feature-list">
                            <li><i class="fas fa-check"></i> Everything in Starter</li>
                            <li><i class="fas fa-check"></i> Event Management</li>
                            <li><i class="fas fa-check"></i> Event Fee Collection</li>
                            <li><i class="fas fa-check"></i> User & Role Management</li>
                            <li><i class="fas fa-check"></i> Syllabus Categories</li>
                            <li><i class="fas fa-check"></i> Syllabus Techniques</li>
                            <li><i class="fas fa-check"></i> Student Progress Tracking</li>
                            <li><i class="fas fa-check"></i> Audit Logs</li>
                            <li><i class="fas fa-check"></i> Advanced Permissions</li>
                            <li><i class="fas fa-check"></i> Priority Support</li>
                        </ul>
                    </div>
                    <a href="#" class="plan-button featured-button">Start Free Trial</a>
                </div>

                <!-- Enterprise Plan -->
                <div class="pricing-card">
                    <div class="plan-header">
                        <h3>Enterprise</h3>
                        <p>For large academy chains</p>
                    </div>
                    <div class="plan-price">
                        <span class="currency">₹</span>
                        <span class="amount monthly-price">11,999</span>
                        <span class="amount yearly-price" style="display: none;">9,599</span>
                        <span class="period">/month</span>
                    </div>
                    <div class="plan-features">
                        <div class="feature-limits">
                            <div class="limit-item">
                                <i class="fas fa-building"></i>
                                <span>Unlimited Branches</span>
                            </div>
                            <div class="limit-item">
                                <i class="fas fa-user-tie"></i>
                                <span>Unlimited Coaches</span>
                            </div>
                            <div class="limit-item">
                                <i class="fas fa-users"></i>
                                <span>Unlimited Students</span>
                            </div>
                        </div>
                        <ul class="feature-list">
                            <li><i class="fas fa-check"></i> Everything in Professional</li>
                            <li><i class="fas fa-check"></i> Multi-Academy Management</li>
                            <li><i class="fas fa-check"></i> Custom Academy Branding</li>
                            <li><i class="fas fa-check"></i> Advanced Analytics & Reports</li>
                            <li><i class="fas fa-check"></i> Bulk Operations</li>
                            <li><i class="fas fa-check"></i> Data Export/Import</li>
                            <li><i class="fas fa-check"></i> Academy Performance Metrics</li>
                            <li><i class="fas fa-check"></i> Dedicated Account Manager</li>
                            <li><i class="fas fa-check"></i> 24/7 Phone Support</li>
                            <li><i class="fas fa-check"></i> Custom Feature Development</li>
                        </ul>
                    </div>
                    <a href="#" class="plan-button">Contact Sales</a>
                </div>
            </div>

            <!-- Additional Pricing Info -->
            <div class="pricing-footer">
                <div class="pricing-notes">
                    <h4>All Plans Include:</h4>
                    <div class="included-features">
                        <span><i class="fas fa-shield-alt"></i> SSL Security</span>
                        <span><i class="fas fa-cloud"></i> Cloud Hosting</span>
                        <span><i class="fas fa-sync"></i> Automatic Backups</span>
                        <span><i class="fas fa-desktop"></i> Web Access</span>
                        <span><i class="fas fa-clock"></i> 99.9% Uptime</span>
                        <span><i class="fas fa-headset"></i> Email Support</span>
                    </div>
                </div>
                
                <div class="money-back">
                    <i class="fas fa-money-bill-wave"></i>
                    <div>
                        <strong>30-Day Money Back Guarantee</strong>
                        <p>Not satisfied? Get a full refund within 30 days.</p>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Access Panels -->
    <section id="access" class="access-panels">
        <div class="container">
            <div class="section-title">
                <h2>Choose Your Access Level</h2>
                <p>Different portals for different roles in your sports academy</p>
            </div>
            
            <div class="panels-grid">
                <div class="panel-card">
                    <div class="panel-icon">
                        <i class="fas fa-building"></i>
                    </div>
                    <h3>Academy Panel</h3>
                    <p>Academy administrators and staff management portal for day-to-day operations and student management.</p>
                    <a href="{{ url('/academy') }}" class="panel-btn" target="_blank">
                        Access Academy Panel
                    </a>
                </div>
                
                <div class="panel-card">
                    <div class="panel-icon">
                        <i class="fas fa-graduation-cap"></i>
                    </div>
                    <h3>Student Panel</h3>
                    <p>Student dashboard for viewing progress, schedules, payments, and participating in academy activities.</p>
                    <a href="{{ url('/student') }}" class="panel-btn" target="_blank">
                        Access Student Panel
                    </a>
                </div>
            </div>
        </div>
    </section>

    <!-- Footer -->
    <footer id="contact" class="footer">
        <div class="footer-content">
            <div class="footer-section">
                <h3>International Sports Solutions</h3>
                <p>Empowering sports academies worldwide with comprehensive management solutions. Transform your academy operations today.</p>
                <div style="margin-top: 1rem;">
                    <i class="fab fa-facebook" style="margin-right: 1rem; font-size: 1.25rem;"></i>
                    <i class="fab fa-twitter" style="margin-right: 1rem; font-size: 1.25rem;"></i>
                    <i class="fab fa-instagram" style="margin-right: 1rem; font-size: 1.25rem;"></i>
                    <i class="fab fa-linkedin" style="font-size: 1.25rem;"></i>
                </div>
            </div>
            
            <div class="footer-section">
                <h3>Features</h3>
                <ul>
                    <li><a href="#">Student Management</a></li>
                    <li><a href="#">Class Scheduling</a></li>
                    <li><a href="#">Fee Management</a></li>
                    <li><a href="#">Performance Analytics</a></li>
                    <li><a href="#">Event Management</a></li>
                </ul>
            </div>
            
            <div class="footer-section">
                <h3>Support</h3>
                <ul>
                    <li><a href="#">Documentation</a></li>
                    <li><a href="#">Video Tutorials</a></li>
                    <li><a href="#">Contact Support</a></li>
                    <li><a href="#">System Status</a></li>
                    <li><a href="#">Community Forum</a></li>
                </ul>
            </div>
            
            <div class="footer-section">
                <h3>Contact Info</h3>
                <p><i class="fas fa-envelope"></i> info@internationalsportssolutions.com</p>
                <p><i class="fas fa-phone"></i> +1 (555) 123-4567</p>
                <p><i class="fas fa-map-marker-alt"></i> Global Sports Tech Hub</p>
                <p style="margin-top: 1rem;">
                    <strong>Business Hours:</strong><br>
                    Monday - Friday: 9:00 AM - 6:00 PM<br>
                    Saturday: 10:00 AM - 4:00 PM
                </p>
            </div>
        </div>
        
        <div class="footer-bottom">
            <p>&copy; {{ date('Y') }} International Sports Solutions. All rights reserved. | Privacy Policy | Terms of Service</p>
        </div>
    </footer>

    <!-- JavaScript -->
    <script>
        // Smooth scrolling for navigation links
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            });
        });
        
        // Header background change on scroll
        window.addEventListener('scroll', function() {
            const header = document.querySelector('.header');
            if (window.scrollY > 100) {
                header.style.background = 'rgba(255, 255, 255, 0.98)';
                header.style.boxShadow = '0 2px 20px rgba(0, 0, 0, 0.1)';
            } else {
                header.style.background = 'rgba(255, 255, 255, 0.95)';
                header.style.boxShadow = 'none';
            }
        });
        
        // Intersection Observer for animations
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };
        
        const observer = new IntersectionObserver(function(entries) {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }
            });
        }, observerOptions);
        
        // Observe all animated elements
        document.querySelectorAll('.fade-in-up').forEach(el => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(30px)';
            el.style.transition = 'all 0.8s ease';
            observer.observe(el);
        });
        
        // Panel button click handling with loading state
        document.querySelectorAll('.panel-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                const originalText = this.innerHTML;
                this.innerHTML = '<div class="loading"></div> Loading...';
                this.style.pointerEvents = 'none';
                
                // Reset after 3 seconds if still on page
                setTimeout(() => {
                    this.innerHTML = originalText;
                    this.style.pointerEvents = 'auto';
                }, 3000);
            });
        });
        
        // Pricing toggle functionality
        const durationToggle = document.getElementById('durationToggle');
        const monthlyPrices = document.querySelectorAll('.monthly-price');
        const yearlyPrices = document.querySelectorAll('.yearly-price');
        
        if (durationToggle) {
            durationToggle.addEventListener('change', function() {
                if (this.checked) {
                    // Show yearly prices
                    monthlyPrices.forEach(price => price.style.display = 'none');
                    yearlyPrices.forEach(price => price.style.display = 'inline');
                } else {
                    // Show monthly prices
                    monthlyPrices.forEach(price => price.style.display = 'inline');
                    yearlyPrices.forEach(price => price.style.display = 'none');
                }
            });
        }
        
        // Plan button click handling
        document.querySelectorAll('.plan-button').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                const planName = this.closest('.pricing-card').querySelector('.plan-header h3').textContent;
                const isYearly = document.getElementById('durationToggle').checked;
                const duration = isYearly ? 'yearly' : 'monthly';
                
                // You can customize this action - redirect to signup, show modal, etc.
                alert(`Starting ${planName} plan (${duration} billing). Redirecting to signup...`);
                
                // Example: redirect to signup with plan info
                // window.location.href = `/signup?plan=${planName.toLowerCase()}&billing=${duration}`;
            });
        });
    </script>
</body>
</html>