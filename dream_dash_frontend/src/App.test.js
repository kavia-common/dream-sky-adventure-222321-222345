import { render, screen } from '@testing-library/react';
import App from './App';

test('renders Game status bar with score and time', () => {
  render(<App />);
  const scoreElement = screen.getByText(/Score:\s*0/i);
  const timeElement = screen.getByText(/Time:\s*0s/i);
  expect(scoreElement).toBeInTheDocument();
  expect(timeElement).toBeInTheDocument();
});
