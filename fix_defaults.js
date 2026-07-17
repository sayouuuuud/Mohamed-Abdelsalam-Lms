const fs = require('fs');
let s = fs.readFileSync('prisma/schema.prisma', 'utf8');
s = s.replace(/@default\(dbgenerated\("lower[^)]+\)\)"\)\)/g, '');
s = s.replace(/@default\(dbgenerated\("LEAST[^)]+\)"\)\)/g, '');
fs.writeFileSync('prisma/schema.prisma', s);
console.log('Defaults fixed');
