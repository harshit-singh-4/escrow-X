import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
      throw new Error('MONGODB_URI is not defined in .env');
    }

    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 3000,
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return true;
  } catch (error) {
    console.warn(`MongoDB Connection Notice: ${error.message}`);
    return false;
  }
};

export default connectDB;
