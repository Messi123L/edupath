import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../utils/LanguageContext';

export default function MindMapViewer({ mindmapData, title }) {
  const { t, lang } = useLanguage();
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [selectedNode, setSelectedNode] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const containerRef = useRef(null);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const SVG_WIDTH = 1000;
  const SVG_HEIGHT = 600;
  const NODE_WIDTH = 160;
  const NODE_HEIGHT = 70;

  // Calculate node positions with deterministic radial layout
  const [positionedNodes, setPositionedNodes] = useState([]);
  const [links, setLinks] = useState([]);

  useEffect(() => {
    if (!mindmapData || !mindmapData.nodes || mindmapData.nodes.length === 0) return;

    const { nodes, links: rawLinks } = mindmapData;
    const rootNode = nodes.find(n => n.type === 'root') || nodes[0];
    const mainNodes = nodes.filter(n => n.type === 'main');
    
    // Parent map
    const parentMap = {};
    rawLinks.forEach(link => {
      parentMap[link.target] = link.source;
    });

    const positions = {};

    // 1. Position root at the center
    const centerX = SVG_WIDTH / 2;
    const centerY = SVG_HEIGHT / 2;
    positions[rootNode.id] = { x: centerX, y: centerY };

    // 2. Position main nodes (inner circle)
    const R1 = 180; // Inner Radius
    mainNodes.forEach((node, index) => {
      const angle = (2 * Math.PI * index) / mainNodes.length - Math.PI / 2;
      const x = centerX + R1 * Math.cos(angle);
      const y = centerY + R1 * Math.sin(angle);
      positions[node.id] = { x, y, angle };
    });

    // 3. Position sub-nodes (concepts connected to main nodes)
    const subNodesGroup = {};
    nodes.forEach(node => {
      if (node.type !== 'root' && node.type !== 'main') {
        const parentId = parentMap[node.id] || rootNode.id;
        if (!subNodesGroup[parentId]) {
          subNodesGroup[parentId] = [];
        }
        subNodesGroup[parentId].push(node);
      }
    });

    Object.keys(subNodesGroup).forEach(parentId => {
      const parentPos = positions[parentId];
      if (!parentPos) return;

      const children = subNodesGroup[parentId];
      const parentAngle = parentPos.angle !== undefined ? parentPos.angle : 0;
      
      const spreadAngle = (Math.PI / 180) * 80; // Spread arc (e.g., 80 degrees)
      const R2 = 130; // Outer Radius from parent

      children.forEach((child, index) => {
        let childAngle;
        if (children.length === 1) {
          childAngle = parentAngle;
        } else {
          const step = spreadAngle / (children.length - 1);
          childAngle = parentAngle - spreadAngle / 2 + index * step;
        }

        const x = parentPos.x + R2 * Math.cos(childAngle);
        const y = parentPos.y + R2 * Math.sin(childAngle);
        positions[child.id] = { x, y };
      });
    });

    // Populate positions
    const newPositionedNodes = nodes.map(node => ({
      ...node,
      x: positions[node.id]?.x || centerX,
      y: positions[node.id]?.y || centerY
    }));

    setPositionedNodes(newPositionedNodes);
    
    // Select root node by default
    setSelectedNode(rootNode);

    // Build paths
    const positionedLinks = rawLinks.map((link, idx) => {
      const sourceNode = newPositionedNodes.find(n => n.id === link.source);
      const targetNode = newPositionedNodes.find(n => n.id === link.target);
      if (sourceNode && targetNode) {
        return {
          id: `link_${idx}`,
          source: sourceNode,
          target: targetNode
        };
      }
      return null;
    }).filter(l => l !== null);

    setLinks(positionedLinks);
  }, [mindmapData]);

  // Pan actions
  const handleMouseDown = (e) => {
    if (e.target.tagName === 'BUTTON' || e.target.closest('.interactive-sidebar')) return;
    isDragging.current = true;
    dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e) => {
    if (!isDragging.current) return;
    setPan({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    });
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  // Zoom action
  const handleWheel = (e) => {
    e.preventDefault();
    const zoomFactor = 1.1;
    let newZoom = zoom;
    if (e.deltaY < 0) {
      newZoom = Math.min(zoom * zoomFactor, 3);
    } else {
      newZoom = Math.max(zoom / zoomFactor, 0.4);
    }
    setZoom(newZoom);
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Export SVG
  const exportSVG = () => {
    if (!containerRef.current) return;
    const svgElement = containerRef.current.querySelector('svg');
    if (!svgElement) return;

    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svgElement);
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `mindmap-${title.toLowerCase().replace(/\s+/g, '-')}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Curved lines paths
  const getCurvePath = (link) => {
    const { source, target } = link;
    const midX = (source.x + target.x) / 2;
    return `M ${source.x} ${source.y} C ${midX} ${source.y}, ${midX} ${target.y}, ${target.x} ${target.y}`;
  };

  return (
    <div className="glass-panel animate-fade-in" style={{ padding: '1.8rem', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
      
      {/* Control bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', marginBottom: '0.2rem', fontWeight: '800' }}>{t('mindmap_viewer_title')}</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
            {t('mindmap_viewer_desc')}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
          <input
            type="text"
            placeholder={t('mindmap_search_placeholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '220px', padding: '0.55rem 0.9rem', fontSize: '0.82rem' }}
          />
          <button className="btn btn-secondary" onClick={resetView} style={{ padding: '0.55rem 0.9rem', fontSize: '0.82rem' }}>
            {t('mindmap_reset_btn')}
          </button>
          <button className="btn btn-accent" onClick={exportSVG} style={{ padding: '0.55rem 0.9rem', fontSize: '0.82rem' }}>
            {t('mindmap_export_btn')}
          </button>
        </div>
      </div>

      <div className="mindmap-layout-grid">
        
        {/* Main interactive SVG box */}
        <div 
          ref={containerRef}
          className="svg-mindmap-container"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
          {/* Zoom controls */}
          <div style={{
            position: 'absolute',
            bottom: '15px',
            right: '15px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            zIndex: 10
          }}>
            <button className="btn btn-secondary" onClick={() => setZoom(z => Math.min(z * 1.2, 3))} style={{ width: '36px', height: '36px', padding: 0, justifyContent: 'center', borderRadius: '50%', background: 'rgba(15,23,42,0.6)' }}>+</button>
            <button className="btn btn-secondary" onClick={() => setZoom(z => Math.max(z / 1.2, 0.4))} style={{ width: '36px', height: '36px', padding: 0, justifyContent: 'center', borderRadius: '50%', background: 'rgba(15,23,42,0.6)' }}>-</button>
          </div>

          <svg width="100%" height="100%" viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} style={{ pointerEvents: 'none' }}>
            <defs>
              <pattern id="dot-grid" width="24" height="24" patternUnits="userSpaceOnUse">
                <circle cx="12" cy="12" r="1.2" className="mindmap-grid-dot" />
              </pattern>
            </defs>
            {/* Background grid */}
            <rect width="100%" height="100%" fill="url(#dot-grid)" style={{ pointerEvents: 'auto' }} />
            
            <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`} style={{ pointerEvents: 'auto' }}>
              
              {/* Draw connection lines */}
              {links.map(link => {
                const isHighlighted = selectedNode && (selectedNode.id === link.source.id || selectedNode.id === link.target.id);
                return (
                  <path
                    key={link.id}
                    d={getCurvePath(link)}
                    className="mindmap-link"
                    stroke={isHighlighted ? 'var(--secondary)' : 'rgba(255, 255, 255, 0.08)'}
                    strokeWidth={isHighlighted ? 2.5 : 1.2}
                    style={{ filter: isHighlighted ? 'drop-shadow(0 0 3px rgba(6, 182, 212, 0.5))' : 'none' }}
                  />
                );
              })}

              {/* Draw node objects */}
              {positionedNodes.map(node => {
                const isSelected = selectedNode?.id === node.id;
                const matchesSearch = searchTerm && node.label.toLowerCase().includes(searchTerm.toLowerCase());
                
                const cardClass = `mindmap-node-card node-${node.type} ${isSelected ? 'node-selected' : ''} ${matchesSearch ? 'node-searched' : ''}`;

                return (
                  <g 
                    key={node.id} 
                    transform={`translate(${node.x - NODE_WIDTH / 2}, ${node.y - NODE_HEIGHT / 2})`}
                    onClick={() => setSelectedNode(node)}
                    className="mindmap-node-element"
                  >
                    <foreignObject width={NODE_WIDTH} height={NODE_HEIGHT} style={{ pointerEvents: 'auto' }}>
                      <div className={cardClass}>
                        <div style={{ 
                          fontSize: '0.74rem', 
                          fontWeight: '750', 
                          lineHeight: '1.25',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          color: 'var(--text-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.25rem'
                        }}>
                          <span style={{ fontSize: '0.85rem' }}>{node.type === 'root' ? '🎯' : node.type === 'main' ? '📖' : '💡'}</span>
                          <span style={{ textOverflow: 'ellipsis', overflow: 'hidden' }}>{node.label}</span>
                        </div>
                        <div style={{ 
                          fontSize: '0.56rem', 
                          color: 'var(--text-muted)', 
                          marginTop: '4px', 
                          textTransform: 'uppercase',
                          fontWeight: '800',
                          letterSpacing: '0.06em'
                        }}>
                          {node.type === 'root' ? (lang === 'fr' ? 'Sujet' : lang === 'ar' ? 'الموضوع' : 'Subject') : node.type === 'main' ? (lang === 'fr' ? 'Chapitre' : lang === 'ar' ? 'الفصل' : 'Chapter') : (lang === 'fr' ? 'Concept' : lang === 'ar' ? 'المفهوم' : 'Concept')}
                        </div>
                      </div>
                    </foreignObject>
                  </g>
                );
              })}

            </g>
          </svg>
        </div>

        {/* Sidebar sidebar node info pane */}
        <div className="glass-panel interactive-sidebar" style={{ 
          padding: '1.4rem', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '1.1rem', 
          background: 'rgba(10, 15, 30, 0.45)',
          border: '1px solid var(--border-glass)' 
        }}>
          {selectedNode ? (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <span className={`badge badge-${selectedNode.type === 'root' ? 'analyse' : selectedNode.type === 'main' ? 'comprehension' : 'memorisation'}`} style={{ fontSize: '0.62rem' }}>
                  {selectedNode.type === 'root' ? (lang === 'fr' ? 'Nœud Racine' : lang === 'ar' ? 'العقدة الجذرية' : 'Root Node') : selectedNode.type === 'main' ? (lang === 'fr' ? 'Chapitre Principal' : lang === 'ar' ? 'الفصل الرئيسي' : 'Main Chapter') : (lang === 'fr' ? 'Sous-Concept clé' : lang === 'ar' ? 'مفهوم فرعي رئيسي' : 'Key Sub-Concept')}
                </span>
                <h3 style={{ fontSize: '1.1rem', marginTop: '0.6rem', lineHeight: '1.3', fontWeight: '800' }}>
                  {selectedNode.label}
                </h3>
              </div>
              
              <hr style={{ border: 'none', borderBottom: '1px solid var(--border-glass)' }} />
              
              <div>
                <h4 style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.35rem', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '0.04em' }}>
                  {t('mindmap_sidebar_title')}
                </h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.55', fontWeight: '500' }}>
                  {selectedNode.description || (lang === 'fr' ? "Aucune description supplémentaire fournie pour ce concept." : lang === 'ar' ? "لا يوجد وصف إضافي متوفر لهذا المفهوم." : "No additional description provided for this concept.")}
                </p>
              </div>

              {selectedNode.type !== 'root' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.5rem' }}>
                  <h4 style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '0.04em' }}>
                    {t('mindmap_sidebar_ref')}
                  </h4>
                  <code style={{ 
                    fontSize: '0.72rem', 
                    color: 'var(--secondary)', 
                    background: 'rgba(0,0,0,0.35)', 
                    padding: '0.25rem 0.5rem', 
                    borderRadius: '6px', 
                    alignSelf: 'flex-start',
                    border: '1px solid var(--border-glass)'
                  }}>
                    {selectedNode.id}
                  </code>
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', textAlign: 'center' }}>
              <span style={{ fontSize: '2rem', marginBottom: '0.8rem' }}>🧠</span>
              <p style={{ fontSize: '0.82rem', lineHeight: '1.4' }}>
                {t('mindmap_sidebar_desc')}
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
