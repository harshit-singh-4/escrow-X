import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true 
  },
  email: { 
    type: String, 
    required: true, 
    unique: true 
  },
  password: { 
    type: String, 
    required: true 
  },
  role: { 
    type: String, 
    enum: ['client', 'freelancer'], 
    default: 'client' 
  },
  walletAddress: { 
    type: String, 
    default: '' 
  },
  bio: { 
    type: String, 
    default: '' 
  },
  skills: [{ 
    type: String 
  }],
  links: {
    github: { type: String, default: '' },
    twitter: { type: String, default: '' },
    portfolio: { type: String, default: '' }
  },
  avatar: { 
    type: String, 
    default: '' 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

const User = mongoose.model('User', userSchema);
export default User;
