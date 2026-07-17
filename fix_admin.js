const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      if (file.endsWith('.ts') || file.endsWith('.tsx')) results.push(file);
    }
  });
  return results;
}

const files = walk('app/admin');
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;
  
  content = content.replace(/hasResourceAccess\(\s*supabase\s*,/g, 'hasResourceAccess(');
  content = content.replace(/getCurrentRole\(\s*supabase\s*\)/g, 'getCurrentRole()');
  content = content.replace(/getPermissionMap\(\s*supabase\s*\)/g, 'getPermissionMap()');
  content = content.replace(/requireAdmin\(\s*supabase\s*\)/g, 'requireAdmin()');
  content = content.replace(/isStaff\(\s*supabase\s*\)/g, 'isStaff()');
  content = content.replace(/getCurrentStudent\(\s*supabase\s*\)/g, 'getCurrentStudent()');

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Updated', file);
  }
});
console.log('Done!');
