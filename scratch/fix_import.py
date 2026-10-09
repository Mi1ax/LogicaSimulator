import re

with open('src/ui/components/Toolbox.tsx', 'r') as f:
    content = f.read()

content = content.replace("} , Trash2 } from 'lucide-react';", ", Trash2 } from 'lucide-react';")

with open('src/ui/components/Toolbox.tsx', 'w') as f:
    f.write(content)
