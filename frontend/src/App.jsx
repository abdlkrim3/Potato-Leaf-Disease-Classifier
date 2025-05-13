import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import axios from 'axios';
import './App.css';


// Constants for disease information
const DISEASE_INFO = {
  "Early Blight": {
    advice: "Apply copper-based fungicides weekly. Remove infected leaves promptly.",
    colorClass: "early-blight"
  },
  "Late Blight": {
    advice: "URGENT: Remove and destroy infected plants. Use fungicides with mancozeb.",
    colorClass: "late-blight"
  },
  "Healthy": {
    advice: "Your potato plant is healthy! Maintain proper watering and fertilization.",
    colorClass: "healthy"
  }
};

function App() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const onDrop = useCallback((acceptedFiles) => {
    const selectedFile = acceptedFiles[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
      setResult(null);
      setError(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png']
    },
    maxFiles: 1,
    multiple: false,
    maxSize: 5 * 1024 * 1024 // 5MB
  });
	const analyzePotatoLeaf = async () => {
	if (!file) {
		setError("Please select an image first");
		return;
	  }

	  setLoading(true);
	  setError(null);
	  
	  const formData = new FormData();
	  formData.append('file', file);

	  try {
		const response = await axios.post('http://localhost:8000/predict', formData, {
		  headers: {
			'Content-Type': 'multipart/form-data'
		  },
		  timeout: 10000 // 10 seconds timeout
		});
		
		if (!response.data?.prediction) {
		  throw new Error("Invalid response from server");
		}

		// Process the probabilities
		const processedProbabilities = {};
		for (const [key, value] of Object.entries(response.data.class_probabilities || {})) {
		  processedProbabilities[key] = Math.min(Math.max(parseFloat(value), 0), 1);
		}

		setResult({
		  ...response.data,
		  confidence: Math.min(Math.max(parseFloat(response.data.confidence), 0), 1),
		  class_probabilities: processedProbabilities
		});

	  } catch (error) {
		console.error("Analysis error:", error);
		let errorMessage = "Analysis failed. Please try again.";
		
		if (error.response) {
		  errorMessage = error.response.data?.detail || errorMessage;
		} else if (error.request) {
		  errorMessage = "Server is not responding. Please try later.";
		}
		
		setError(errorMessage);
	  } finally {
		setLoading(false);
	  }
	};

  const resetAnalysis = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
  };

  return (
    <div className="app-container">
		<div className="content-wrapper">
		  <header>
			<img src="./assets/062bb78052b1e36ca68fadb5b3951249.jpeg" alt="potato logo" className="logo"></img>
			<h1 >Potato Disease Classifier</h1>
			<p>Upload an image of a potato leaf for analysis</p>
		  </header>

		  <div 
			{...getRootProps()}
			className={`dropzone ${isDragActive ? 'active' : ''}`}
		  >
			<input {...getInputProps()} />
			{isDragActive ? (
			  <p>Drop the potato leaf image here...</p>
			) : (
			  <p>Drag & drop a leaf image here, or click to select (max 5MB)</p>
			)}
		  </div>

		  {error && (
			<div className="error-message">
			  {error}
			  <button onClick={resetAnalysis} className="retry-btn">
				Try Again
			  </button>
			</div>
		  )}

		  {preview && (
			<div className="preview-section">
			  <div className="image-preview">
				<h3>Selected Image:</h3>
				<img src={preview} alt="Potato leaf preview" />
				<button 
				  onClick={resetAnalysis}
				  className="change-btn"
				>
				  Change Image
				</button>
			  </div>
			  <button 
				onClick={analyzePotatoLeaf} 
				disabled={loading}
				className={`analyze-btn ${loading ? 'loading' : ''}`}
			  >
				{loading ? (
				  <>
					<span className="spinner"></span>
					Analyzing...
				  </>
				) : (
				  'Analyze Leaf'
				)}
			  </button>
			</div>
		  )}

		  {result && (
			<div className={`results ${DISEASE_INFO[result.prediction]?.colorClass || ''}`}>
			  <h2>Diagnosis: {result.prediction}</h2>
			  <div className="confidence-meter">
				<div 
				  className="confidence-fill" 
				  style={{ width: `${result.confidence * 100}%` }}
				></div>
				<span>{(result.confidence * 100).toFixed(1)}% Confidence</span>
			  </div>
			  
			  <div className="probabilities">
				<h3>Detailed Analysis:</h3>
				<ul>
				  {Object.entries(result.class_probabilities).map(([disease, probability]) => (
					<li key={disease}>
					  <span className="disease-name">{disease}</span>
					  <span className="probability-bar">
						<span 
						  style={{ width: `${probability * 100}%` }}
						></span>
					  </span>
					  <span className="probability-value">{(probability * 100).toFixed(1)}%</span>
					</li>
				  ))}
				</ul>
			  </div>

			  <div className="advice">
				<h3>Recommended Action:</h3>
				<p>{DISEASE_INFO[result.prediction]?.advice || "Consult an agricultural expert."}</p>
			  </div>
			</div>
		  )}
		</div>
	</div>
  );
}

export default App;