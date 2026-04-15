import React from 'react';
import '../styles/Icons.css';

export default function DesignShowcase() {
  return (
    <div style={{ padding: '2rem', background: '#f8fafc', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      {/* Header */}
      <h1 style={{ color: '#0078d4', marginBottom: '3rem' }}>SmartCollab Dashboard Design Showcase</h1>

      {/* 1. Color Palette */}
      <section style={{ marginBottom: '3rem', background: 'white', padding: '2rem', borderRadius: '12px' }}>
        <h2>Color Palette</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
          <div>
            <div style={{ width: '100%', height: '80px', background: '#0078d4', borderRadius: '8px' }}></div>
            <p>Primary Blue<br/>#0078d4</p>
          </div>
          <div>
            <div style={{ width: '100%', height: '80px', background: '#005a9e', borderRadius: '8px' }}></div>
            <p>Secondary Blue<br/>#005a9e</p>
          </div>
          <div>
            <div style={{ width: '100%', height: '80px', background: '#107c10', borderRadius: '8px' }}></div>
            <p>Success Green<br/>#107c10</p>
          </div>
          <div>
            <div style={{ width: '100%', height: '80px', background: '#ffb900', borderRadius: '8px' }}></div>
            <p>Warning Yellow<br/>#ffb900</p>
          </div>
          <div>
            <div style={{ width: '100%', height: '80px', background: '#d13438', borderRadius: '8px' }}></div>
            <p>Danger Red<br/>#d13438</p>
          </div>
          <div>
            <div style={{ width: '100%', height: '80px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e8ecf1' }}></div>
            <p>Light Background<br/>#f8fafc</p>
          </div>
        </div>
      </section>

      {/* 2. Icon System */}
      <section style={{ marginBottom: '3rem', background: 'white', padding: '2rem', borderRadius: '12px' }}>
        <h2>Line-Style Icon System</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '1rem' }}>
          {[
            { icon: '⊞', label: 'Dashboard', code: '⊞' },
            { icon: '▯', label: 'Projects', code: '▯' },
            { icon: '☑', label: 'Tasks', code: '☑' },
            { icon: '✉', label: 'Messages', code: '✉' },
            { icon: '⚙', label: 'Settings', code: '⚙' },
            { icon: '✓', label: 'Complete', code: '✓' },
            { icon: '✎', label: 'Edit', code: '✎' },
            { icon: '✕', label: 'Delete', code: '✕' },
            { icon: '◆', label: 'Pin', code: '◆' },
            { icon: '◇', label: 'Unpin', code: '◇' },
            { icon: '⇅', label: 'Sort', code: '⇅' },
            { icon: '⌕', label: 'Search', code: '⌕' },
          ].map((item, i) => (
            <div key={i} style={{ textAlign: 'center', padding: '1rem', background: '#f8fafc', borderRadius: '8px' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{item.icon}</div>
              <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>{item.label}</p>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#a6a6a6' }}>{item.code}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Card Component */}
      <section style={{ marginBottom: '3rem', background: 'white', padding: '2rem', borderRadius: '12px' }}>
        <h2>Overview Cards</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          {[
            { icon: '▯', value: '12', label: 'Total Projects', color: '#0078d4' },
            { icon: '✓', value: '24', label: 'Completed Tasks', color: '#107c10' },
            { icon: '◐', value: '8', label: 'Active Projects', color: '#0078d4' },
            { icon: '◉', value: '15', label: 'Team Members', color: '#0078d4' },
          ].map((card, i) => (
            <div key={i} style={{
              background: 'white',
              border: '1px solid #e8ecf1',
              borderRadius: '12px',
              padding: '1.5rem',
              display: 'flex',
              gap: '1rem',
              alignItems: 'center',
              transition: 'all 0.3s ease',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              cursor: 'pointer'
            }} onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.08)';
            }} onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)';
            }}>
              <div style={{
                width: '50px',
                height: '50px',
                background: `linear-gradient(135deg, ${card.color} 0%, ${card.color}cc 100%)`,
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '1.5rem',
                fontWeight: 800,
                flexShrink: 0
              }}>
                {card.icon}
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800, color: '#1a1a1a' }}>{card.value}</p>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#a6a6a6', fontWeight: 600 }}>{card.label}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Task Card */}
      <section style={{ marginBottom: '3rem', background: 'white', padding: '2rem', borderRadius: '12px' }}>
        <h2>Task Board Cards</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
          {[
            { title: 'To Do', count: 5, color: '#e8ecf1' },
            { title: 'In Progress', count: 3, color: '#ffb900' },
            { title: 'Done', count: 8, color: '#107c10' },
          ].map((column, i) => (
            <div key={i}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem',
                paddingBottom: '1rem',
                borderBottom: `2px solid ${column.color}`
              }}>
                <h3 style={{ margin: 0 }}>{column.title}</h3>
                <span style={{
                  background: '#0078d4',
                  color: 'white',
                  borderRadius: '20px',
                  padding: '0.25rem 0.75rem',
                  fontSize: '0.8rem',
                  fontWeight: 700
                }}>
                  {column.count}
                </span>
              </div>
              {[1, 2].map((j) => (
                <div key={j} style={{
                  background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                  border: '1px solid #e8ecf1',
                  borderLeft: `4px solid ${column.color}`,
                  borderRadius: '8px',
                  padding: '1rem',
                  marginBottom: '0.75rem',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer'
                }} onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
                }} onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}>
                  <p style={{ margin: '0 0 0.5rem 0', fontWeight: 700, color: '#1a1a1a' }}>Task {i}-{j}</p>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#a6a6a6' }}>Project: Sample</p>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* 5. Buttons & Actions */}
      <section style={{ marginBottom: '3rem', background: 'white', padding: '2rem', borderRadius: '12px' }}>
        <h2>Button Styles</h2>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button style={{
            background: 'linear-gradient(135deg, #0078d4 0%, #005a9e 100%)',
            color: 'white',
            border: 'none',
            padding: '0.75rem 1.25rem',
            borderRadius: '6px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: '0 2px 8px rgba(0, 120, 212, 0.2)'
          }} onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 120, 212, 0.3)';
          }} onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 120, 212, 0.2)';
          }}>
            Primary Button
          </button>

          <button style={{
            background: 'rgba(0, 120, 212, 0.1)',
            color: '#0078d4',
            border: 'none',
            padding: '0.75rem 1.25rem',
            borderRadius: '6px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0, 120, 212, 0.2)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(0, 120, 212, 0.1)'}>
            ✎ Edit
          </button>

          <button style={{
            background: 'rgba(209, 52, 56, 0.1)',
            color: '#d13438',
            border: 'none',
            padding: '0.75rem 1.25rem',
            borderRadius: '6px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(209, 52, 56, 0.2)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(209, 52, 56, 0.1)'}>
            ✕ Delete
          </button>

          <button style={{
            background: 'rgba(255, 185, 0, 0.1)',
            color: '#ffb900',
            border: 'none',
            padding: '0.75rem 1.25rem',
            borderRadius: '6px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 185, 0, 0.2)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 185, 0, 0.1)'}>
            ◆ Pin
          </button>
        </div>
      </section>

      {/* 6. Status Indicators */}
      <section style={{ marginBottom: '3rem', background: 'white', padding: '2rem', borderRadius: '12px' }}>
        <h2>Status Indicators</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          {[
            { icon: '✓', label: 'Completed', color: '#107c10', bg: '#f0fdf0' },
            { icon: '◐', label: 'In Progress', color: '#ffb900', bg: '#fffbf0' },
            { icon: '⏱', label: 'Pending', color: '#0078d4', bg: '#f0f5fa' },
            { icon: '!', label: 'Alert', color: '#d13438', bg: '#fef0f0' },
          ].map((status, i) => (
            <div key={i} style={{
              background: status.bg,
              border: `1px solid ${status.color}33`,
              borderRadius: '8px',
              padding: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                background: status.color,
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.2rem',
                fontWeight: 700
              }}>
                {status.icon}
              </div>
              <p style={{ margin: 0, fontWeight: 600, color: status.color }}>{status.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <section style={{ textAlign: 'center', color: '#a6a6a6', marginTop: '3rem' }}>
        <p>SmartCollab Dashboard Design System v1.0</p>
        <p>Modern • Minimal • Professional</p>
      </section>
    </div>
  );
}
