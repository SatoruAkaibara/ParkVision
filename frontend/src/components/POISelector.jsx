import React from 'react';

const POISelector = ({ graph, selectedPoi, setSelectedPoi }) => {
    // Filter the graph to only show nodes that have a specific POI label
    const poiNodes = graph.nodes ? graph.nodes.filter(node => node.poiLabel) : [];

    return (
        <div style={{ marginBottom: '20px' }}>
            <label style={{ marginRight: '10px', fontWeight: 'bold', fontSize: '16px' }}>
                Where do you want to park near?
            </label>
            <select
                value={selectedPoi || ''}
                onChange={(e) => setSelectedPoi(parseInt(e.target.value) || null)}
                style={{ padding: '10px', fontSize: '16px', borderRadius: '5px' }}
            >
                <option value="">Just find the nearest spot</option>
                {poiNodes.map(node => (
                    <option key={node.id} value={node.id}>
                        {node.poiLabel}
                    </option>
                ))}
            </select>
        </div>
    );
};

export default POISelector;