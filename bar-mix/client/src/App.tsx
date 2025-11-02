import React from 'react';
import Header from './components/Header';
import './styles/global.css';

const App: React.FC = () => {
    return (
        <div>
            <Header />
            <h1>Welcome to Bar Mix</h1>
            {/* Additional components and content can be added here */}
        </div>
    );
};

export default App;