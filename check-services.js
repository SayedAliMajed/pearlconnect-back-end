require('dotenv').config();
const mongoose = require('mongoose');

async function checkServices() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Load models properly
    require('./models/user');
    require('./models/services');
    require('./models/category');
    
    const Service = mongoose.model('Service');
    const services = await Service.find({}).populate('provider', 'username');
    
    console.log('\\n=== ALL SERVICES ===');
    services.forEach(service => {
      console.log('\\n--- SERVICE ---');
      console.log('Title:', service.title);
      console.log('Provider:', service.provider?.username);
      console.log('Images array:', JSON.stringify(service.images, null, 2));
      console.log('Images count:', service.images?.length || 0);
      console.log('First image URL:', service.images?.[0]?.url || 'N/A');
    });
    
    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

checkServices();
