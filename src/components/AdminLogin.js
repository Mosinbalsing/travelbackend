const handleLogin = async (e) => {
    e.preventDefault();
    
    try {
        const credentials = {
            email: email,
            password: password
        };

        const result = await adminLogin(credentials);
        
        if (result.success) {
            // Store token in localStorage
            localStorage.setItem('adminToken', result.data.token);
            // Navigate to admin dashboard
            navigate('/admin/dashboard');
        }
    } catch (error) {
        // Show error message to user
        setError(error.message);
    }
}; 