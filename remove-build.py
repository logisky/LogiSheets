from os import walk, remove

for (dirpath, dirnames, filenames) in walk('./web'):
    if 'BUILD' in filenames:
        remove(dirpath + '/BUILD')
