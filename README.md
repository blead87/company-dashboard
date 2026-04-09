# Company Dashboard

Cross-company todo dashboard for Nelson's ventures (Oorban, MFC Arquitectos, Legnofino, Penalma Capital, Personal).

## Features

- **Company-based organization**: Separate tabs for each venture
- **Priority levels**: High, Medium, Low with color coding
- **Due dates**: Track deadlines with overdue highlighting
- **Mobile-responsive**: Works on phone, tablet, and desktop
- **Local storage**: Saves todos in browser
- **GitHub sync**: Todos stored in `todos.json` for version control

## Access

**Live Dashboard:** https://blead87.github.io/company-dashboard/

## How to Use

### Adding Tasks
1. Use the "Quick Add" field in the header for simple tasks
2. Use the full form in the sidebar for detailed tasks with company, priority, due date, and notes

### Managing Tasks
- **Check/uncheck**: Mark tasks as done/pending
- **Delete**: Remove completed or irrelevant tasks
- **Filter**: Click company tabs to view tasks by venture
- **Sort**: Tasks automatically sort by overdue → priority → due date

### Data Storage
- **Local storage**: Todos save automatically in your browser
- **GitHub**: The `todos.json` file in this repo stores all tasks
- **Sync**: The dashboard loads from GitHub on startup

## Companies

| Company | Color | Description |
|---------|-------|-------------|
| Oorban | Blue | ROMULENS + PARKEADO |
| MFC Arquitectos | Green | Architecture + Interior Design |
| Legnofino | Orange | Softwood Furniture Manufacturing |
| Penalma Capital | Brown | Capital Allocation + Investments |
| Personal | Purple | Personal/Family tasks |

## Development

### Files
- `index.html` - Main dashboard interface
- `dashboard.js` - Todo management logic
- `todos.json` - Task data storage
- `README.md` - This documentation

### Local Development
1. Clone the repo
2. Open `index.html` in a browser
3. Todos save to browser's local storage

### Updating GitHub
To sync local changes to GitHub:
1. Edit `todos.json` with your changes
2. Commit and push:
   ```bash
   git add todos.json
   git commit -m "Updated todos"
   git push
   ```

## Future Enhancements

1. **GitHub API integration**: Auto-sync todos to/from GitHub
2. **User authentication**: Multiple users with permissions
3. **Reminders**: Email/notification for due tasks
4. **Export/Import**: CSV/Excel export functionality
5. **Analytics**: Task completion statistics by company

## License

MIT