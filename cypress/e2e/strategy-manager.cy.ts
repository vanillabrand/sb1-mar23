describe('Strategy Manager', () => {
  beforeEach(() => {
    cy.visit('/strategy');
  });

  it('creates new strategy', () => {
    cy.get('[data-testid="new-strategy-btn"]').click();
    cy.get('[data-testid="strategy-name"]').type('MA Crossover');
    cy.get('[data-testid="strategy-description"]')
      .type('Moving average crossover strategy');
    cy.get('[data-testid="save-strategy"]').click();
    
    cy.get('[data-testid="strategy-list"]')
      .should('contain', 'MA Crossover');
  });

  it('backtests strategy', () => {
    cy.get('[data-testid="strategy-item"]').first().click();
    cy.get('[data-testid="backtest-btn"]').click();
    cy.get('[data-testid="date-range"]').type('2023-01-01');
    cy.get('[data-testid="run-backtest"]').click();
    
    cy.get('[data-testid="backtest-results"]', { timeout: 10000 })
      .should('be.visible');
  });
});