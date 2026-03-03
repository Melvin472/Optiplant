import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './WeatherBackground.css';

const WeatherBackground = () => {
  const [weather, setWeather] = useState('clear'); // Par défaut
  const [loading, setLoading] = useState(true);

  // Remplace par ta clé API OpenWeatherMap
  const API_KEY = 'VOTRE_CLE_API_ICI';
  const CITY = 'La Garde,FR'; 

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const response = await axios.get(
          `https://api.openweathermap.org/data/2.5/weather?q=${CITY}&appid=${API_KEY}&units=metric`
        );
        
        const mainWeather = response.data.weather[0].main.toLowerCase();
        
        // Mapping des conditions météo vers tes classes CSS
        if (mainWeather.includes('cloud')) setWeather('cloudy');
        else if (mainWeather.includes('rain') || mainWeather.includes('drizzle')) setWeather('rainy');
        else if (mainWeather.includes('clear')) setWeather('sunny');
        else setWeather('sunny'); // Par défaut
        
        setLoading(false);
      } catch (error) {
        console.error("Erreur lors de la récupération de la météo", error);
        setLoading(false);
      }
    };

    fetchWeather();
    // Optionnel : Rafraîchir toutes les 30 minutes
    const interval = setInterval(fetchWeather, 1800000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`background-container ${weather}`}>
      <div className="overlay">
        {/* Ici viendra ton contenu (Bourgeon, Marguerite, etc.) */}
        {loading ? <p>Chargement de la météo...</p> : <h1>Station Agricole - La Garde</h1>}
      </div>
    </div>
  );
};

export default WeatherBackground;