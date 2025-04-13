import {
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    CssBaseline,
    Box,
    Drawer,
} from '@mui/material'
import {Home, Search, Settings} from '@mui/icons-material'

export const BlockView = () => {
    return (
        <Box sx={{display: 'flex'}}>
            <CssBaseline />
            <Drawer
                variant="persistent"
                anchor="right"
                open={true}
                sx={{
                    width: '240px',
                    flexShrink: 0,
                    '& .MuiDrawer-paper': {
                        width: '240px',
                        boxSizing: 'border-box',
                        backgroundColor: '#9e9e9e', // Adjust color as needed
                    },
                }}
            >
                <List>
                    <ListItem>
                        <ListItemIcon>
                            <Home />
                        </ListItemIcon>
                        <ListItemText primary="Home" />
                    </ListItem>
                    <ListItem>
                        <ListItemIcon>
                            <Search />
                        </ListItemIcon>
                        <ListItemText primary="Search" />
                    </ListItem>
                    <ListItem>
                        <ListItemIcon>
                            <Settings />
                        </ListItemIcon>
                        <ListItemText primary="Settings" />
                    </ListItem>
                </List>
            </Drawer>
        </Box>
    )
}
