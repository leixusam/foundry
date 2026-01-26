import * as readline from 'readline';

// Create a readline interface for interactive input
function createInterface(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

// Prompt user for text input
export async function prompt(question: string): Promise<string> {
  const rl = createInterface();

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// Prompt user for yes/no confirmation
export async function confirm(question: string): Promise<boolean> {
  const answer = await prompt(`${question} (y/n): `);
  return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
}

// Display a list and prompt user to select one
export async function selectFromList(question: string, options: string[]): Promise<string> {
  console.log(question);
  options.forEach((option, index) => {
    console.log(`  ${index + 1}. ${option}`);
  });

  const answer = await prompt('Enter number: ');
  const index = parseInt(answer, 10) - 1;

  if (index >= 0 && index < options.length) {
    return options[index];
  }

  // Invalid selection - recursively ask again
  console.log('Invalid selection. Please try again.');
  return selectFromList(question, options);
}
