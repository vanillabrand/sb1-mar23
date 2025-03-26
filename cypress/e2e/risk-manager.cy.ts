describe('Risk Manager Page', () => {
  beforeEach(() => {
    cy.visit('/risk-manager');
  });

  it('displays risk management dashboard', () => {
    cy.get('h1').should('contain', 'Risk Management Dashboard');
    cy.get('[data-testid="market-sentiment"]').should('exist');
    cy.get('[data-testid="volatility-index"]').should('exist');
  });

  it('updates metrics when refresh button is clicked', () => {
    cy.intercept('GET', '/api/market-metrics', {
      statusCode: 200,
      body: {
        volatilityIndex: 75,
        marketSentiment: 'bullish',
        trendStrength: 85,
        liquidityScore: 80
      }
    }).as('getMetrics');

    cy.get('[data-testid="refresh-button"]').click();
    cy.wait('@getMetrics');
    
    cy.get('[data-testid="market-sentiment"]')
      .should('contain', 'Bullish');
  });

  it('displays error message when API fails', () => {
    cy.intercept('GET', '/api/market-metrics', {
      statusCode: 500,
      body: { error: 'Internal Server Error' }
    }).as('getMetricsError');

    cy.get('[data-testid="refresh-button"]').click();
    cy.wait('@getMetricsError');
    
    cy.get('[data-testid="error-message"]')
      .should('contain', 'Failed to load risk data');
  });
});