import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { InfluxDB, Point} from '@influxdata/influxdb-client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './WeatherBackground.css';

// --- CONFIGURATION INFLUXDB ---
// VÉRIFIEZ BIEN CES 3 LIGNES DANS VOTRE INTERFACE INFLUXDB :
const token = '6KfZI_aNwkSCzFOZwEdDQMjv6qTEP3mgCdwPRH3w9lZ64o48m8bf4emqqYQeniv-GObHOvkXVMHcJ__VgWyu3g==';
const org = 'geii'; 
const bucket = 'Optiplant';

// On passe par le proxy configuré dans vite.config.js
// Remplace l'ancienne URL longue par le raccourci du proxy
const url = '/api-influx';

const queryApi = new InfluxDB({ url, token }).getQueryApi(org);
// 2. AJOUT DE L'API D'ÉCRITURE :
const writeApi = new InfluxDB({ url, token }).getWriteApi(org, bucket, 'ns');


// --- DONNÉES ÉQUIPE ---
const TEAM_MEMBERS = [
  { role: "Supervision WEB", icon: "💻", members: [{ name: "Melvin Lacote", url: "https://www.linkedin.com/in/melvin-lacote/" }, { name: "Victor Brice-Rey", url: "https://www.linkedin.com/in/victor-brice-rey/" }, { name: "Jean Pacteau", url: "https://www.linkedin.com/in/jean-pacteau/" }] },
  { role: "Caméra", icon: "📷", members: [{ name: "Théo Bordes", url: "https://www.linkedin.com/in/théo-bordes-754660329/" }] },
  { role: "Base de Donnée", icon: "🗄️", members: [{ name: "Yanis Bouzidi", url: "https://www.linkedin.com/in/yanis-boutekka/" }, { name: "Sofiane Beji", url: "https://www.linkedin.com/in/sofiane-beji-trapani-0b5973330/" }, { name: "Akram Maarad", url: "https://www.linkedin.com/in/akram-maarad/" }, { name: "Antonin Moreau", url: "https://www.linkedin.com/in/antonin-pons-hermant-moreau/" }] },
  { role: "CodeSys", icon: "⚙️", members: [{ name: "Minh Quan Ly", url: "https://www.linkedin.com/in/minh-quan-ly-1111m2005a/" }] },
];

// Noms fixes pour les bacs
const BAC_NAMES = ["Bac Nord (Tomates)", "Bac Sud (Salades)", "Bac Est (Fraises)", "Bac Ouest (Radis)"];

const VIDEO_IDS = {
  sunny: 'gZgpNehW2mg',
  cloudy: 'N_qYlSRolO8', // Exemple : Nuages
  rainy: 'q76bMs-NwRk'   // Exemple : Pluie relaxante
};

const WeatherBackground = () => {
  const [weatherData, setWeatherData] = useState(null);
  const [forecastData, setForecastData] = useState([]);
  const [weatherClass, setWeatherClass] = useState('sunny');
  const [loading, setLoading] = useState(true);
  
  const [bacs, setBacs] = useState(BAC_NAMES.map((nom, i) => ({
    id: i + 1,
    tag: `bac${i + 1}`,
    nom: nom,
    tempSol: '--',
    humSol: '--',
    alerte: null,
    etape: i === 0 ? "Fructification" : (i === 1 ? "Croissance" : "Semis"), 
    historique: []
  })));
  
  const [globalRecipes, setGlobalRecipes] = useState([
    { name: "Eau Claire (Standard)", water: 10, ingredients: [] },
    { name: "Booster Croissance N+", water: 50, ingredients: [{name: "Azote (N)", val: 10}] }
  ]);

  const [view, setView] = useState('dashboard');
  const [selectedBac, setSelectedBac] = useState(null);

  const API_KEY = 'd6d37191b20ec585c39e1c2f9ebf1193';
  const CITY = 'La Valette-du-Var,FR'; 

  // --- FONCTION RÉCUPÉRATION INFLUXDB ---
  const fetchBacsData = async () => {
    const fluxQuery = `
      from(bucket: "${bucket}")
        |> range(start: -15m)
        |> filter(fn: (r) => r["_measurement"] == "optiplant")
        |> last()
    `;

    console.log("⏳ Tentative de connexion InfluxDB...");

    try {
      const results = [];
      // On utilise queryApi.queryRows qui est plus robuste
      for await (const {values, tableMeta} of queryApi.iterateRows(fluxQuery)) {
        const o = tableMeta.toObject(values);
        results.push(o);
      }

      console.log("✅ Données InfluxDB reçues :", results);

      if (results.length > 0) {
        setBacs(currentBacs => currentBacs.map(bac => {
          const tempResult = results.find(r => r.tag === bac.tag && r._field === "temp_sol");
          const humResult = results.find(r => r.tag === bac.tag && r._field === "humi_sol");
          
          const temp = tempResult ? Math.round(tempResult._value) : (bac.tempSol !== '--' ? bac.tempSol : '--');
          const hum = humResult ? Math.round(humResult._value) : (bac.humSol !== '--' ? bac.humSol : '--');

          let alerte = null;
          if (typeof hum === 'number' && hum < 20) alerte = "Manque d'eau";

          return {
            ...bac,
            tempSol: temp,
            humSol: hum,
            alerte: alerte,
            historique: [
              { jour: 'J-2', t: typeof temp === 'number' ? temp - 2 : 20, h: 60 },
              { jour: 'Hier', t: typeof temp === 'number' ? temp - 1 : 21, h: 62 },
              { jour: 'Ajd', t: typeof temp === 'number' ? temp : 22, h: typeof hum === 'number' ? hum : 65 }
            ]
          };
        }));
      } else {
        console.warn("⚠️ Aucune donnée trouvée pour les 30 derniers jours.");
      }

    } catch (error) {
      console.error("❌ ERREUR CRITIQUE INFLUXDB :", error);
      if (error.body) {
        console.error("Détail de l'erreur serveur :", error.body);
      }
    }
  };

  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true);
        // API Météo (si ça plante ici, commentez temporairement)
        try {
            const resCurrent = await axios.get(`https://api.openweathermap.org/data/2.5/weather?q=${CITY}&appid=${API_KEY}&units=metric&lang=fr`);
            setWeatherData(resCurrent.data);
            const resForecast = await axios.get(`https://api.openweathermap.org/data/2.5/forecast?q=${CITY}&appid=${API_KEY}&units=metric&lang=fr`);
            setForecastData(resForecast.data.list.filter(reading => reading.dt_txt.includes("12:00:00")));
            
            const main = resCurrent.data.weather[0].main.toLowerCase();
            const description = resCurrent.data.weather[0].description.toLowerCase(); // 👈 CETTE LIGNE MANQUAIT !
            if (main.includes('rain')) setWeatherClass('rainy');
            else if (main.includes('cloud')) {
            // L'EXCEPTION EST ICI 👇
              if (description.includes('peu nuageux')) {
                setWeatherClass('sunny'); // On force le beau temps !
            } else {
              setWeatherClass('cloudy'); // Sinon on laisse nuageux
            }
            } else {
              setWeatherClass('sunny');
              }
        } catch (e) {
            console.warn("Météo non disponible");
            setWeatherData({main: {temp: 20, humidity: 50}, weather: [{description: "Indisponible", main: "Clear"}], wind: {speed: 0, deg: 0}});
        }

        // Appel InfluxDB
        await fetchBacsData();
        
      } catch (error) { 
        console.error("Erreur chargement:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
    const intervalId = setInterval(fetchBacsData, 10000);
    return () => clearInterval(intervalId);
  }, []);

  // Handlers
  const goToBac = (bac) => { setSelectedBac(bac); setView('bac-detail'); };
  const goToWeather = () => { setView('weather-detail'); };
  const goToTeam = () => { setView('team-detail'); };
  const goToRecipes = () => { setView('recipes'); };
  const goHome = () => { setView('dashboard'); setSelectedBac(null); };

  const handleAddRecipe = (newRecipe) => {
    setGlobalRecipes([...globalRecipes, newRecipe]);
    goHome();
  };

  return (
    <div className="app-container">
{/* --- FOND VIDÉO LOCAL --- */}
{/* --- FOND VIDÉO YOUTUBE --- */}
      <div className="background-layer">
        <iframe
          src={`https://www.youtube.com/embed/${VIDEO_IDS[weatherClass]}?autoplay=1&mute=1&loop=1&playlist=${VIDEO_IDS[weatherClass]}&controls=0&showinfo=0&rel=0&iv_load_policy=3&modestbranding=1`}
          frameBorder="0"
          allow="autoplay; encrypted-media"
          title="Weather Background"
        />
      </div>

      <div className="interface-layer">
        {!loading && weatherData ? (
          <>
            {view === 'dashboard' && (
              <Dashboard 
                weatherData={weatherData} 
                bacs={bacs} 
                onSelectBac={goToBac} 
                onSelectWeather={goToWeather} 
                onSelectTeam={goToTeam}
                onSelectRecipes={goToRecipes}
              />
            )}
            {view === 'bac-detail' && selectedBac && <BacDetails bac={selectedBac} onBack={goHome} recipes={globalRecipes} />}
            {view === 'weather-detail' && <WeatherDetails current={weatherData} forecast={forecastData} onBack={goHome} />}
            {view === 'team-detail' && <TeamDetails onBack={goHome} />}
            {view === 'recipes' && <RecipeCreator onBack={goHome} onSave={handleAddRecipe} />}
          </>
        ) : (
          <div className="loading-screen"><div className="loader-spinner"></div><p>Connexion à InfluxDB...</p></div>
        )}
      </div>
    </div>
  );
};

// --- DASHBOARD ---
const Dashboard = ({ weatherData, bacs, onSelectBac, onSelectWeather, onSelectTeam, onSelectRecipes }) => (
  <div className="dashboard">
    <div className="header-section">
      <h1 className="main-title">Supervision La Valette</h1>
      <button className="recipe-btn" onClick={onSelectRecipes}>
        <span className="icon">🧪</span> Créer une Recette
      </button>
    </div>

    <div className="grid-layout">
      <div className="bac-column">
        {bacs.slice(0, 2).map(bac => <BacItem key={bac.id} bac={bac} onSelect={onSelectBac} />)}
      </div>
      <div className="center-column">
        <div className={`weather-tank clickable ${weatherData.weather[0].main.toLowerCase().includes('rain') ? 'stormy-water' : 'calm-water'}`} onClick={onSelectWeather}>
          <div className="tank-liquid" style={{ height: '75%' }}><div className="wave wave1"></div><div className="wave wave2"></div></div>
          <div className="tank-content">
            <div className="tank-header">
              <div className="header-left"><span className="icon-search">🔍</span><h2>Cuve & Météo</h2></div>
              <span className="tank-capacity">750L / 1000L</span>
            </div>
            <div className="main-temp-display">
              <div className="big-temp">{Math.round(weatherData.main.temp)}°C</div>
              <p className="weather-desc">{weatherData.weather[0].description}</p>
            </div>
            <div className="weather-pills">
              <div className="pill"><span>💧 Humidité</span><strong>{weatherData.main.humidity}%</strong></div>
              <div className="pill"><span>💨 Vent</span><strong>{Math.round(weatherData.wind.speed * 3.6)} km/h</strong></div>
            </div>
          </div>
        </div>
        <div className="glass-card team-card" onClick={onSelectTeam}>
          <div className="team-left"><span className="team-emoji">👥</span><div className="team-info"><h3>Équipe Projet</h3><p>Organigramme & Rôles</p></div></div>
          <div className="team-avatars"><div className="avatar">M</div><div className="avatar">V</div><div className="avatar">J</div></div>
        </div>
      </div>
      <div className="bac-column">
        {bacs.slice(2, 4).map(bac => <BacItem key={bac.id} bac={bac} onSelect={onSelectBac} />)}
      </div>
    </div>
  </div>
);

// --- DÉTAILS BAC ---
const BacDetails = ({ bac, onBack, recipes }) => {
  const getProgress = (etape) => {
    switch(etape) { case 'Semis': return 25; case 'Croissance': return 50; case 'Floraison': return 75; case 'Fructification': return 100; default: return 10; }
  };
  const [config, setConfig] = useState({ germination: recipes[0]?.name || '', croissance: recipes[0]?.name || '', fructification: recipes[0]?.name || '' });

  return (
    <div className="details-container">
      <button className="btn-back" onClick={onBack}>← Retour Supervision</button>
      <div className="details-header glass-card">
        <div><h2>{bac.nom}</h2><span className="subtitle-id">ID: #{bac.tag}</span></div>
        <span className={bac.alerte ? "alert-badge pulse" : "safe-badge"}>{bac.alerte ? `⚠️ ${bac.alerte}` : "✅ Paramètres Optimaux"}</span>
      </div>
      <div className="details-grid">
        <div className="left-detail-col">
          <div className="glass-card sensor-card">
            <h3>Capteurs Sol (InfluxDB)</h3>
            <div className="sensor-row">
              <div className="sensor-box"><span className="icon">🌡️</span><span>Temp. Sol</span><strong className="value temp">{bac.tempSol !== '--' ? `${bac.tempSol}°C` : '--'}</strong></div>
              <div className="sensor-box"><span className="icon">💧</span><span>Humidité</span><strong className="value hum">{bac.humSol !== '--' ? `${bac.humSol}%` : '--'}</strong></div>
            </div>
          </div>
          <div className="glass-card stage-card">
            <h3>Cycle Actuel</h3>
            <div className="plant-stage">
              <div className="stage-info"><span>Stade :</span><strong className="highlight-stage">{bac.etape}</strong></div>
              <div className="progress-bar-bg"><div className="progress-bar-fill" style={{width: `${getProgress(bac.etape)}%`}}></div></div>
              <div className="stages-labels"><small>Semis</small><small>Croiss.</small><small>Flor.</small><small>Fruit</small></div>
            </div>
          </div>
        </div>
        <div className="glass-card recipe-config-card">
          <h3>Planning Nutritionnel</h3>
          {['germination', 'croissance', 'fructification'].map(stage => (
            <div key={stage} className="stage-selector">
              <label>{stage.charAt(0).toUpperCase() + stage.slice(1)}</label>
              <select className="glass-select" value={config[stage]} onChange={(e) => setConfig({...config, [stage]: e.target.value})}>
                {recipes.map((r, i) => <option key={i} value={r.name}>{r.name}</option>)}
              </select>
            </div>
          ))}
          <button className="btn-save-config">Sauvegarder Planning</button>
        </div>
      </div>
      <div className="glass-card chart-card">
        <h3>Historique</h3>
        <div style={{ width: '100%', height: 250 }}>
          <ResponsiveContainer>
            <LineChart data={bac.historique}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="jour" stroke="#ccc" />
              <YAxis stroke="#ccc" />
              <Tooltip contentStyle={{ backgroundColor: '#1e272e', border: 'none', color: '#fff' }} />
              <Line type="monotone" dataKey="t" name="Temp (°C)" stroke="#ff9f43" strokeWidth={3} />
              <Line type="monotone" dataKey="h" name="Hum (%)" stroke="#54a0ff" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

// --- CRÉATEUR DE RECETTES ---
const RecipeCreator = ({ onBack, onSave }) => {
  const [recipeName, setRecipeName] = useState('');
  const [waterAmount, setWaterAmount] = useState('');
  const [selectedNutrient, setSelectedNutrient] = useState('Azote (N)');
  const [isCustomNutrient, setIsCustomNutrient] = useState(false);
  const [customNutrientName, setCustomNutrientName] = useState('');
  const [percent, setPercent] = useState('');
  const [ingredients, setIngredients] = useState([]);
  const nutrientOptions = ["Azote (N)", "Phosphore (P)", "Potassium (K)", "Calcium (Ca)", "Magnésium (Mg)"];

  const handleNutrientChange = (e) => {
    const val = e.target.value;
    if (val === 'custom') { setIsCustomNutrient(true); setSelectedNutrient(''); } 
    else { setIsCustomNutrient(false); setSelectedNutrient(val); }
  };

  const addIngredient = () => {
    const name = isCustomNutrient ? customNutrientName : selectedNutrient;
    if (name && percent) {
      setIngredients([...ingredients, { name, val: percent }]);
      setPercent('');
      if(isCustomNutrient) setCustomNutrientName('');
    }
  };

  const handleValidate = () => {
    if (recipeName && waterAmount) {
      onSave({name: recipeName, water: waterAmount, ingredients});
    } else {
      alert("Veuillez remplir le nom et la quantité d'eau.");
    }
  };

  return (
    <div className="details-container recipe-view">
      <button className="btn-back" onClick={onBack}>← Retour</button>
      <div className="glass-card recipe-form-card">
        <h3 className="form-title">Créer une recette</h3>
        <div className="input-group full-width"><label>Nom de la recette</label><input type="text" placeholder="Ex: Solution Tomates" className="glass-input" value={recipeName} onChange={(e) => setRecipeName(e.target.value)} /></div>
        <div className="form-row-split">
          <div className="form-column">
            <h4>Nutriments</h4>
            <div className="nutrient-adder">
              <select className="glass-select" value={isCustomNutrient ? 'custom' : selectedNutrient} onChange={handleNutrientChange}>
                {nutrientOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                <option value="custom">➕ Autre...</option>
              </select>
              <div className="percent-input-wrapper"><input type="number" placeholder="%" className="glass-input small" value={percent} onChange={(e) => setPercent(e.target.value)} /><span className="unit">%</span></div>
            </div>
            {isCustomNutrient && <input type="text" className="glass-input custom-nutrient-input" placeholder="Nom du nutriment..." value={customNutrientName} onChange={(e) => setCustomNutrientName(e.target.value)} autoFocus />}
            <button className="btn-add" onClick={addIngredient}>Ajouter</button>
            <div className="ingredients-list">{ingredients.map((ing, i) => (<div key={i} className="ingredient-tag"><span>{ing.name}: <strong>{ing.val}%</strong></span><button className="btn-remove" onClick={() => {const n=[...ingredients];n.splice(i,1);setIngredients(n);}}>×</button></div>))}</div>
          </div>
          <div className="form-column center-content">
            <h4>Eau (Litres)</h4>
            <div className="water-input-wrapper"><input type="number" className="glass-input large-text" placeholder="0" value={waterAmount} onChange={(e) => setWaterAmount(e.target.value)} /><span className="unit-large">L</span></div>
            <div className="water-icon">💧</div>
          </div>
        </div>
        <button className="btn-validate" onClick={handleValidate}>VALIDER LA RECETTE</button>
      </div>
    </div>
  );
};

// --- AUTRES COMPOSANTS ---
const WeatherDetails = ({ current, forecast, onBack }) => { const windSpeedKm = Math.round(current.wind.speed * 3.6); return (<div className="details-container weather-detailed-view"><button className="btn-back" onClick={onBack}>← Retour</button><div className="details-header glass-card"><h2>Météo Détaillée</h2><span className="safe-badge">La Valette-du-Var</span></div><div className="details-grid"><div className="glass-card wind-card"><h3>Analyse du Vent</h3><div className="wind-container"><div className="wind-info"><span className="wind-val">{windSpeedKm} <small>km/h</small></span><span className="wind-dir" style={{transform: `rotate(${current.wind.deg}deg)`}}>➤</span><span className="wind-label">Cap: {current.wind.deg}°</span></div><WindDots speed={windSpeedKm} /></div></div><div className="glass-card atm-card"><h3>Atmosphère</h3><div className="atm-grid"><div className="atm-box"><span>Humidité</span><strong>{current.main.humidity}%</strong></div><div className="atm-box"><span>Pression</span><strong>{current.main.pressure} hPa</strong></div><div className="atm-box"><span>Ressenti</span><strong>{Math.round(current.main.feels_like)}°C</strong></div><div className="atm-box"><span>Visibilité</span><strong>{current.visibility / 1000} km</strong></div></div></div></div><div className="glass-card forecast-card"><h3>Prévisions sur 5 Jours</h3><div className="forecast-list">{forecast.map((day, index) => (<div key={index} className="forecast-item"><span className="f-day">{new Date(day.dt * 1000).toLocaleDateString('fr-FR', {weekday: 'short'})}</span><img src={`https://openweathermap.org/img/wn/${day.weather[0].icon}.png`} alt="icon" /><div className="f-temp"><span className="max">{Math.round(day.main.temp_max)}°</span> <span className="min">{Math.round(day.main.temp_min)}°</span></div></div>))}</div></div></div>); };
const WindDots = ({ speed }) => { const totalDots = 20; const active = Math.floor((speed / 50) * totalDots); return <div className="wind-dots-wrapper"><p>Intensité</p><div className="dots-grid">{[...Array(totalDots)].map((_, i) => (<div key={i} className={`wind-dot ${i < active ? 'active' : ''}`} style={{ transitionDelay: `${i * 0.05}s` }}></div>))}</div></div>; };
const TeamDetails = ({ onBack }) => ( <div className="details-container team-view"><button className="btn-back" onClick={onBack}>← Retour</button><div className="details-header glass-card"><h2>Organigramme & LinkedIn</h2></div><div className="team-grid">{TEAM_MEMBERS.map((group, index) => (<div key={index} className="glass-card team-group-card"><div className="group-header"><span className="group-icon">{group.icon}</span><h3>{group.role}</h3></div><ul className="member-list">{group.members.map((member, i) => (<li key={i} className={member.name.includes("Yanis") ? "is-king" : ""}><a href={member.url} target="_blank" rel="noopener noreferrer" className="member-link">{member.name} <span className="linkedin-arrow">↗</span></a>{member.name.includes("Yanis") && <span className="crown-anim">👑</span>}</li>))}</ul></div>))}</div></div> );

const BacItem = ({ bac, onSelect }) => (
  <div className={`glass-card bac-card ${bac.alerte ? 'border-red' : 'border-green'}`} onClick={() => onSelect(bac)}>
    <div className={`status-badge-corner ${bac.alerte ? 'bg-red' : 'bg-green'}`}>{bac.alerte ? '⚠️ ALERTE' : '✅ OK'}</div>
    <div className="bac-img-container"><img src="/bac.png" alt="Bac" /></div>
    <div className="bac-info-large">
        <h3>{bac.nom}</h3>
        <p className="bac-subtitle">
            T: {bac.tempSol !== '--' ? `${bac.tempSol}°C` : '--'} | H: {bac.humSol !== '--' ? `${bac.humSol}%` : '--'}
        </p>
    </div>
  </div>
);

export default WeatherBackground;