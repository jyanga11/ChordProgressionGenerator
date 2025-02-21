import { useEffect, useState } from "react"
import Select from "react-select"
import makeAnimated from 'react-select/animated';
import { motion } from "framer-motion";


function App() {
  let [chordProgression, setChordProgression] = useState([]);
  let [allChords, setAllChords] = useState([]);
  let [selectedChords, setSelectedChords] = useState([]);
  let [midiURL, setMidiURL] = useState(null);
  let [length, setLength] = useState(4);
  let [temperature, setTemperature] = useState(1.0);
  let [repetitiveness, setRepetitiveness] = useState(2.0);
  let [windowSize, setWindowSize] = useState(4);

  const animatedComponents = makeAnimated();

  // Gets a list of chords for the user to select
  const getAllChords = async () => {
    const response = await fetch("/chords", {
      method : "GET",
      headers: {"Content-Type" : "application/json" },
    });

    const data = await response.json();
    let temp = []
    data.all_chords.values().forEach(element => {
      temp.push({"label": element, "value": element})
    });
    setAllChords(temp);
  }

  // Requests a chord progression from the backend
  const generateChords = async () => {
    if (selectedChords.length > length) {
      alert("The given chord sequence is longer than the requested chord progression!");
      return;
    }

    const response = await fetch("/generate", {
      method : "POST",
      headers : {"Content-Type" : "application/json" },
      body : JSON.stringify({ 'length': length,
                              'temperature': temperature,
                              'repetitiveness': repetitiveness,
                              'window_size': windowSize,
                              'selected_chords': selectedChords
                            }),
    });

    const data = await response.json();
    setChordProgression(data.chord_progression);
    setMidiURL(data.midi_url);
  }

  const downloadMIDI = () => {
    if (midiURL) {
      const fullURL = `${midiURL}`;
      console.log("Download: ", fullURL);
      const a = document.createElement('a');
      a.href = fullURL;
      a.download = "chord_progression.mid";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }

  // Ran on load
  useEffect(() => {
    getAllChords();    // Populates the select list
  },[])

  // Function to dynamically render div holders for chord names
  // Based on the requested length of the chord progression
  const renderBoxes = () => {
    return Array.from({ length }).map((_, index) => (
      <motion.div
        key={index}
        style={{
          display:'flex',
          flexDirection:'column',
          justifyContent:'center',
          alignItems:'center',
          margin:'1em',
          padding:'0.5em',
          height:'7em',
          width: '10em',
          backgroundColor: '#8400ff',
          borderRadius: '15px 50px',
          fontSize: '1.1em',
          fontWeight: 'bold',
          color: 'white',
          boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        }}
        whileHover={{ scale: 1.05, boxShadow: '0 6px 12px rgba(0, 0, 0, 0.3)' }}
      >
        {chordProgression[index] || '   \n   \n'}
      </motion.div>
    ));
  };

  // Custom styling for the select list
  const customStyles = {
    control: (base) => ({
      ...base,
      backgroundColor: "#8400ff",
      "&:hover": { border: "1px solid #ff00f7"},
    }),
    option: (base, { isFocused, isSelected }) => ({
      ...base,
      backgroundColor: isSelected ? "#8400ff" : isFocused ? "#8400ff" : "#460385",
      color: isSelected ? "#ff00f7" : "white",
      fontWeight: 'bold',
    }),
  };
  
  return (
    
    <motion.div
    className="mx-auto"
    style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      backgroundColor: '#460385',
      color: 'white',
    }}
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ duration: 0.5 }}
  >

      <motion.div   // Chords
        className="grid grid-cols-4 gap-4 grid-flow-row auto-rows-fr"
        style={{
          display: 'grid',
          height:'50em',
          gridTemplateColumns:'repeat(4, 1fr)',
          padding:'2.5em',
          textAlign: 'center',
          margin: 'auto',
          marginTop:'1em',
          marginBottom: '0.2em',
          justifyContent:'center',
          alignContent:'center',
        }}
      >
        {renderBoxes()}
      </motion.div>

      <div   /*Select list*/   >
        <div style={{margin:'auto', marginBottom:'2em', width:'40em', alignContent:'center'}}>
          <Select
            styles={customStyles}
            options={allChords}
            value={selectedChords}
            onChange={setSelectedChords}
            placeholder="Select a chord sequence to begin with..."
            isMulti
            components={animatedComponents}
          />
        </div>
        <div  // Settings Sliders
          className="mt-8 space-y-6 w-full max-w-md"
          style={{display:'flex', margin: '0.8em', marginBottom:'2em', justifyContent: 'center'}}
        >
          {[
            { label: "Length", value: length, setter: setLength, min: 1, max: 8, step: 1 },
            { label: "Temperature", value: temperature, setter: setTemperature, min: 0.1, max: 2.0, step: 0.1 },
            { label: "Repetitiveness", value: repetitiveness, setter: setRepetitiveness, min: 0, max: 4, step: 1 },
          ].map(({ label, value, setter, min, max, step }) => (
            <div key={label} style={{marginLeft:'3em', marginRight:'3em'}}>
              <label
                className="text-white font-medium mb-2 flex items-center justify-between"
                style={{fontWeight:'bold'}}
              >
                  {label}: {value}
              </label>
              <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(e) => setter(Number(e.target.value))}
                className="w-full accent-teal-500 cursor-pointer"
                style={{
                  width: '100%',
                  accentColor: '#ff00f7',
                  cursor: 'pointer',
                }}
              />
            </div>
          ))}
        </div>

        <div 
          className="mt-8 w-full max-w-md flex flex-col items-center space-y-4"
          style={{margin:'auto', textAlign:'center', display:'flex', justifyContent: 'center'}}
        >
          <motion.button // Generate button
            onClick={generateChords}
            className="w-full"
            style={{
              backgroundColor: '#9200a8',
              color: 'white',
              fontSize: '1.2em',
              fontWeight: 'bold',
              padding: '1em',
              marginRight: '2em',
              marginBottom:'0.5em',
              borderRadius: '15px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
              transition: 'transform 0.2s ease',
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Generate
          </motion.button>


          <motion.button  // Download button
            onClick={downloadMIDI}
            className="w-full"
            style={{
              backgroundColor: '#6A4C93',
              color: 'white',
              fontSize: '1.2em',
              fontWeight: 'bold',
              padding: '1em',
              marginLeft: '2em',
              marginBottom:'0.5em',
              borderRadius: '15px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
              transition: 'transform 0.2s ease',
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Download
          </motion.button>

        </div>
      </div>
    </motion.div>
  );
}

export default App;
