import { render, screen } from '@testing-library/react';
import App from './App';

test('renders Game status bar', () => {
  render(<App />);
  const scoreElement = screen.getByText(/Score: 0/i);
  expect(scoreElement).toBeInTheDocument();
});
