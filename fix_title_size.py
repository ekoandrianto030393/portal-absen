import os

with open('scan.html', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Reduce main title font size
text = text.replace(
    "font-size: clamp(2.5rem, 6vw, 5rem);",
    "font-size: clamp(1.8rem, 4vw, 3.2rem);"
)

# 2. Reduce subtitle font size
text = text.replace(
    "font-size: clamp(1rem, 2.5vw, 1.8rem);",
    "font-size: clamp(0.8rem, 1.8vw, 1.3rem);"
)

# 3. Reduce location font size
text = text.replace(
    "font-size: clamp(0.65rem, 1.5vw, 0.95rem);",
    "font-size: clamp(0.55rem, 1.2vw, 0.8rem);"
)

# 4. Reduce letter spacing on main title
text = text.replace(
    "letter-spacing: 0.25em;\n        line-height: 1.15;",
    "letter-spacing: 0.2em;\n        line-height: 1.1;"
)

# 5. Reduce margins in the title container to push video up
text = text.replace(
    'pt-0 pb-0 mb-3 mt-2 lg:mt-6',
    'pt-0 pb-0 mb-1 mt-1 lg:mt-2'
)

# 6. Reduce top ornament margin
text = text.replace(
    'max-w-lg mb-4 relative z-10',
    'max-w-lg mb-2 relative z-10'
)

# 7. Reduce main title bottom margin
text = text.replace(
    'gap-3 lg:gap-5 mb-2 relative z-10',
    'gap-2 lg:gap-3 mb-1 relative z-10'
)

# 8. Reduce divider margins
text = text.replace(
    'max-w-2xl mb-3 mt-2 relative z-10',
    'max-w-2xl mb-1 mt-1 relative z-10'
)

# 9. Reduce bottom ornament margin
text = text.replace(
    'max-w-xs mt-2 mb-1 relative z-10',
    'max-w-xs mt-1 mb-0 relative z-10'
)

# 10. Reduce video container top margin
text = text.replace(
    'max-w-[900px] mt-1 overflow-hidden',
    'max-w-[900px] mt-0 overflow-hidden'
)

with open('scan.html', 'w', encoding='utf-8') as f:
    f.write(text)

print("Title size reduced & video pushed up!")
